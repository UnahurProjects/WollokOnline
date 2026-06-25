import "server-only";
import { parseUsernames, sanitizeExamName } from "./exam.service";
import { getGitHubService } from "./github-integration.service";
import { getExamControl, setExamControl, type ExamControl } from "./control.server";

/**
 * Lógica del examen, GitHub-only (sin base de datos).
 * Estado de control (intervalo, cuenta regresiva, cierre) en el repo `_control`.
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
  /** Duración del examen en minutos (0 = sin límite de tiempo). */
  durationMinutes: number;
  teacher: string;
}

export interface StartExamResult {
  examName: string;
  org: string;
  created: { username: string; repoName: string; repoUrl: string }[];
}

/**
 * Inicia el examen: genera un repo privado por alumno desde el template, escribe
 * el intervalo en `.exam/config.json` de cada repo, e inicializa el control central.
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
    await github.commitFiles({
      org,
      repoName: name,
      files: [{ path: ".exam/config.json", content: config }],
      message: "Configuración del examen",
    });
    created.push({ username, repoName: repo.name, repoUrl: repo.url });
  }

  const endsAt =
    input.durationMinutes > 0
      ? new Date(Date.now() + input.durationMinutes * 60_000).toISOString()
      : null;

  await setExamControl(slug, {
    intervalMinutes: input.autoCommitIntervalMinutes,
    endsAt,
    closed: false,
  });

  return { examName: slug, org, created };
}

/** Extiende el examen sumando minutos a la hora de fin (o desde ahora si no había). */
export async function extendExam(
  examName: string,
  minutes: number,
): Promise<{ endsAt: string }> {
  const control = await getExamControl(examName);
  const base = control.endsAt ? new Date(control.endsAt).getTime() : Date.now();
  const endsAt = new Date(base + minutes * 60_000).toISOString();
  await setExamControl(examName, { endsAt });
  return { endsAt };
}

/** Cierre DURO/manual: nadie puede commitear más, sin esperar a la hora de fin. */
export async function closeExam(examName: string): Promise<void> {
  await setExamControl(examName, { closed: true });
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export type ExamActivity = "sin_actividad" | "trabajando" | "entregado";

function ipFromMessage(message: string | undefined): string | null {
  if (!message) return null;
  const m = message.match(/·\s*ip\s+(\S+)/i);
  return m ? m[1] : null;
}

function activityFromMessage(message: string | undefined): ExamActivity {
  if (!message) return "sin_actividad";
  if (/entrega final/i.test(message)) return "entregado";
  if (/auto-save/i.test(message)) return "trabajando";
  return "sin_actividad";
}

export interface DashboardRow {
  username: string;
  repoName: string;
  repoUrl: string;
  lastCommitAt: string | null;
  lastCommitIp: string | null;
  activity: ExamActivity;
  /** true si hace más que el intervalo que no commitea (y el examen no está cerrado). */
  late: boolean;
}

export interface DashboardData {
  rows: DashboardRow[];
  control: ExamControl;
}

export async function getDashboard(examName: string): Promise<DashboardData> {
  const slug = sanitizeExamName(examName);
  const org = getOrg();
  const github = await getGitHubService();

  const control = await getExamControl(slug);
  const repos = await github.listRepos({ org, prefix: `${slug}-` });
  const lasts = await github.getLastCommits({ org, repoNames: repos.map((r) => r.name) });

  const now = Date.now();
  const lateMs = control.intervalMinutes * 60_000;

  const rows: DashboardRow[] = repos.map((r) => {
    const last = lasts[r.name] ?? null;
    const lastAt = last?.committedAt ?? null;
    const late =
      !control.closed && (!lastAt || now - new Date(lastAt).getTime() > lateMs);
    return {
      username: r.name.slice(`${slug}-`.length),
      repoName: r.name,
      repoUrl: r.url,
      lastCommitAt: lastAt,
      lastCommitIp: ipFromMessage(last?.message),
      activity: activityFromMessage(last?.message),
      late,
    };
  });

  // Atrasados primero (más viejo / sin commit arriba), luego el resto por usuario.
  rows.sort((a, b) => {
    if (a.late !== b.late) return a.late ? -1 : 1;
    if (a.late && b.late) {
      const ta = a.lastCommitAt ? new Date(a.lastCommitAt).getTime() : 0;
      const tb = b.lastCommitAt ? new Date(b.lastCommitAt).getTime() : 0;
      return ta - tb;
    }
    return a.username.localeCompare(b.username);
  });

  return { rows, control };
}
