import "server-only";
import { sanitizeExamName } from "./exam.service";
import { getGitHubService } from "./github-integration.service";
import { getOrg } from "./exam.server";
import { getExamControl } from "./control.server";
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
  /** Enunciado en markdown (texto reflowable) o null. Excluyente con statementImageUrl. */
  statementMarkdown: string | null;
  /** Solo .wlk/.wtest (el alumno no ve .exam/). */
  files: WorkspaceFile[];
  lastCommitAt: string | null;
  /** Hora de fin del examen (ISO) o null. El cliente calcula el contador desde acá. */
  endsAt: string | null;
  /** Cierre duro: si true, no puede commitear más. */
  closed: boolean;
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

  // El workspace SIEMPRE carga (aunque esté cerrado): el cliente muestra el estado.
  const control = await getExamControl(slug);
  const all = await github.readWorkspace({ org, repoName: name });

  // Intervalo de auto-commit: del control central (_control), no por repo.
  const interval = control.intervalMinutes;

  const last = await github.getLastCommit({ org, repoName: name });
  const statement = await github.findStatement({ org, repoName: name });
  const statementMarkdown =
    statement?.kind === "markdown"
      ? await github.getFileText({ org, repoName: name }, statement.path)
      : null;

  return {
    examName: slug,
    repoName: name,
    repoUrl: repo.url,
    autoCommitIntervalMinutes: interval,
    statementImageUrl:
      statement?.kind === "image"
        ? `/api/statement?exam=${encodeURIComponent(slug)}`
        : null,
    statementMarkdown,
    files: all.filter((f) => /\.(wlk|wtest)$/i.test(f.path)),
    lastCommitAt: last?.committedAt ?? null,
    endsAt: control.endsAt,
    closed: control.closed,
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
