import "server-only";
import {
  autoSaveCommitMessage,
  finalSubmitCommitMessage,
  isCommittablePath,
} from "./commit";
import { sanitizeExamName } from "./exam.service";
import { getOrg } from "./exam.server";
import { getGitHubService } from "./github-integration.service";
import { getExamControl } from "./control.server";
import { AccessError } from "./student.server";
import type { CommitResult, WorkspaceFile } from "./types";

/**
 * Commit del trabajo del alumno (auto-save, manual o entrega final), GitHub-only.
 *
 * Valida acceso contra GitHub (repo existe + no archivado) y aplica enforcement:
 * solo actualiza archivos QUE YA EXISTEN y son `.wlk`/`.wtest` (el alumno no puede
 * crear ni borrar archivos). La IP de origen se incluye en el mensaje de commit.
 * (En Fase 1 NO se commitea `.exam/activity.ndjson`.)
 */
/** Gracia (ms) para que el último commit entre aunque el reloj difiera un poco. */
const END_GRACE_MS = 120_000;

export async function commitStudentWork(
  examName: string,
  username: string,
  files: WorkspaceFile[],
  kind: "autosave" | "manual" | "final",
  ip: string,
): Promise<CommitResult & { endsAt: string | null }> {
  const slug = sanitizeExamName(examName);
  const org = getOrg();
  const repoName = `${slug}-${username.toLowerCase()}`;
  const github = await getGitHubService();

  const repo = await github.getRepo({ org, repoName });
  if (!repo) throw new AccessError("No estás habilitado para este examen.", 403);
  const control = await getExamControl(slug);
  if (control.closed) throw new AccessError("El examen está cerrado.", 403);
  if (control.endsAt && Date.now() > new Date(control.endsAt).getTime() + END_GRACE_MS) {
    throw new AccessError("Se cumplió el tiempo del examen.", 403);
  }

  // Enforcement: solo archivos existentes, .wlk/.wtest (sin .exam/activity en Fase 1).
  const existing = new Set((await github.readWorkspace({ org, repoName })).map((f) => f.path));
  const payload = files.filter(
    (f) =>
      existing.has(f.path) &&
      /\.(wlk|wtest)$/i.test(f.path) &&
      isCommittablePath(f.path),
  );

  const now = new Date();
  const base =
    kind === "final" ? finalSubmitCommitMessage(now) : autoSaveCommitMessage(now);
  const message = `${base} · ip ${ip}`;

  const result = await github.commitFiles({ org, repoName, files: payload, message });
  return { ...result, endsAt: control.endsAt };
}
