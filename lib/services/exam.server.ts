import "server-only";
import { parseUsernames, sanitizeExamName } from "./exam.service";
import { getGitHubService } from "./github-integration.service";
import type { CommitResult } from "./types";

/**
 * Lógica del examen, GitHub-only (sin base de datos).
 * El "estado" se deriva de GitHub: existe el repo = inscripto; archivado = cerrado.
 */

export function getOrg(): string {
  return process.env.GITHUB_DEFAULT_ORG || "ExamUnahurP";
}

function repoName(examSlug: string, username: string): string {
  return `${examSlug}-${username}`;
}

export interface StartExamInput {
  templateRepo: string;
  examName: string;
  usernames: string;
  autoCommitIntervalMinutes: number;
  teacher: string;
}

export interface StartExamResult {
  examName: string;
  org: string;
  created: { username: string; repoName: string; repoUrl: string }[];
}

/**
 * Inicia el examen: genera un repo privado por alumno desde el template y
 * escribe el intervalo de auto-commit en `.exam/config.json` de cada repo.
 */
export async function startExam(input: StartExamInput): Promise<StartExamResult> {
  const slug = sanitizeExamName(input.examName);
  if (!slug) throw new Error("Nombre de examen inválido.");
  const usernames = parseUsernames(input.usernames);
  if (usernames.length === 0) throw new Error("No se reconoció ningún usuario.");

  const org = getOrg();
  const github = await getGitHubService();
  const config =
    JSON.stringify(
      { autoCommitIntervalMinutes: input.autoCommitIntervalMinutes },
      null,
      2,
    ) + "\n";

  const created = [];
  for (const username of usernames) {
    const name = repoName(slug, username);
    const repo = await github.generateFromTemplate({
      org,
      templateRepo: input.templateRepo,
      repoName: name,
      description: `Examen: ${slug}`,
    });
    // Escribir el intervalo elegido ese día en el repo del alumno.
    await github.commitFiles({
      org,
      repoName: name,
      files: [{ path: ".exam/config.json", content: config }],
      message: "Configuración del examen",
    });
    created.push({ username, repoName: repo.name, repoUrl: repo.url });
  }

  return { examName: slug, org, created };
}

/** Cierra el examen: archiva todos los repos `{examen}-*`. */
export async function closeExam(examName: string): Promise<{ archived: number }> {
  const slug = sanitizeExamName(examName);
  const org = getOrg();
  const github = await getGitHubService();
  const repos = await github.listRepos({ org, prefix: `${slug}-` });
  for (const r of repos) await github.archiveRepo({ org, repoName: r.name });
  return { archived: repos.length };
}

/** Cambia el intervalo de auto-commit en vivo (actualiza el config de todos los repos). */
export async function setInterval(
  examName: string,
  minutes: number,
): Promise<{ updated: number }> {
  const slug = sanitizeExamName(examName);
  const org = getOrg();
  const github = await getGitHubService();
  const repos = await github.listRepos({ org, prefix: `${slug}-` });
  const config = JSON.stringify({ autoCommitIntervalMinutes: minutes }, null, 2) + "\n";
  let updated = 0;
  for (const r of repos) {
    if (r.archived) continue;
    await github.commitFiles({
      org,
      repoName: r.name,
      files: [{ path: ".exam/config.json", content: config }],
      message: "Actualizar intervalo de auto-commit",
    });
    updated++;
  }
  return { updated };
}

/** Extrae la IP del mensaje de commit (formato "… · ip X.X.X.X"). */
function ipFromMessage(message: string | undefined): string | null {
  if (!message) return null;
  const m = message.match(/·\s*ip\s+(\S+)/i);
  return m ? m[1] : null;
}

export interface DashboardRow {
  username: string;
  repoName: string;
  repoUrl: string;
  archived: boolean;
  lastCommitAt: string | null;
  lastCommitIp: string | null;
}

/** Dashboard docente: lista los repos del examen + último commit + IP (leído de GitHub). */
export async function getDashboard(examName: string): Promise<DashboardRow[]> {
  const slug = sanitizeExamName(examName);
  const org = getOrg();
  const github = await getGitHubService();
  const repos = await github.listRepos({ org, prefix: `${slug}-` });

  const rows: DashboardRow[] = [];
  for (const r of repos) {
    let last: CommitResult | null = null;
    try {
      last = await github.getLastCommit({ org, repoName: r.name });
    } catch {
      last = null;
    }
    rows.push({
      username: r.name.slice(`${slug}-`.length),
      repoName: r.name,
      repoUrl: r.url,
      archived: r.archived,
      lastCommitAt: last?.committedAt ?? null,
      lastCommitIp: ipFromMessage(last?.message),
    });
  }
  rows.sort((a, b) => a.username.localeCompare(b.username));
  return rows;
}
