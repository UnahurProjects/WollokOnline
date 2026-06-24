import "server-only";
import { sanitizeExamName } from "./exam.service";
import { getGitHubService } from "./github-integration.service";
import { getOrg } from "./exam.server";
import type { WorkspaceFile } from "./types";

export class AccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface StudentWorkspace {
  examName: string;
  repoName: string;
  repoUrl: string;
  autoCommitIntervalMinutes: number;
  statementImageUrl: string | null;
  /** Solo .wlk/.wtest (el alumno no ve .exam/). */
  files: WorkspaceFile[];
  lastCommitAt: string | null;
}

function studentRepoName(examName: string, username: string): string {
  return `${sanitizeExamName(examName)}-${username.toLowerCase()}`;
}

/**
 * Valida acceso del alumno SOLO contra GitHub:
 *  - existe `{examen}-{usuario}` → está habilitado (= "inscripto");
 *  - no archivado → examen abierto.
 */
export async function getStudentWorkspace(
  examName: string,
  username: string,
): Promise<StudentWorkspace> {
  const slug = sanitizeExamName(examName);
  if (!slug) throw new AccessError("Nombre de examen inválido.", 400);

  const org = getOrg();
  const github = await getGitHubService();
  const name = studentRepoName(slug, username);

  const repo = await github.getRepo({ org, repoName: name });
  if (!repo) {
    throw new AccessError(
      "No estás habilitado para rendir este examen. Consultá con el docente.",
      403,
    );
  }
  if (repo.archived) {
    throw new AccessError("El examen está cerrado.", 403);
  }

  const all = await github.readWorkspace({ org, repoName: name });

  // Config (intervalo) desde .exam/config.json; el alumno no lo ve.
  let interval = 5;
  const configFile = all.find((f) => f.path === ".exam/config.json");
  if (configFile) {
    try {
      const parsed = JSON.parse(configFile.content);
      if (typeof parsed.autoCommitIntervalMinutes === "number") {
        interval = parsed.autoCommitIntervalMinutes;
      }
    } catch {
      // config inválido → default.
    }
  }

  const last = await github.getLastCommit({ org, repoName: name });
  const statementPath = await github.findStatementPath({ org, repoName: name });

  return {
    examName: slug,
    repoName: name,
    repoUrl: repo.url,
    autoCommitIntervalMinutes: interval,
    statementImageUrl: statementPath
      ? `/api/statement?exam=${encodeURIComponent(slug)}`
      : null,
    files: all.filter((f) => /\.(wlk|wtest)$/i.test(f.path)),
    lastCommitAt: last?.committedAt ?? null,
  };
}

/**
 * Bytes de la imagen de enunciado del repo del alumno (para el endpoint /api/statement).
 * Permite verla aunque el examen esté cerrado (archivado).
 */
export async function getStatementImageForStudent(
  examName: string,
  username: string,
): Promise<{ data: Uint8Array; contentType: string } | null> {
  const org = getOrg();
  const github = await getGitHubService();
  const name = studentRepoName(examName, username);
  const repo = await github.getRepo({ org, repoName: name });
  if (!repo) throw new AccessError("No estás habilitado para este examen.", 403);
  return github.getStatementImage({ org, repoName: name });
}
