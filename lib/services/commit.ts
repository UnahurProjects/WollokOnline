import type { WorkspaceFile } from "./types";

/**
 * Whitelist server-side de archivos commiteables.
 *
 * Solo se commitean:
 *  - archivos .wlk y .wtest (código del alumno);
 *  - .exam/activity.ndjson (bitácora de actividad, si está habilitada).
 *
 * Cualquier otro archivo (README, enunciado, configs) NUNCA es editable ni
 * se commitea desde el cliente. Esta validación es independiente del bloqueo
 * de UI: el frontend no es seguridad real.
 */
export const ACTIVITY_LOG_PATH = ".exam/activity.ndjson";

export function isCommittablePath(path: string): boolean {
  const normalized = path.replace(/^\.\//, "").trim();
  if (normalized === ACTIVITY_LOG_PATH) return true;
  return /\.(wlk|wtest)$/i.test(normalized);
}

/** Filtra una lista de archivos dejando solo los commiteables. */
export function filterCommittableFiles(files: WorkspaceFile[]): WorkspaceFile[] {
  return files.filter((f) => isCommittablePath(f.path));
}

/** Mensaje de commit de auto-guardado: "Auto-save examen YYYY-MM-DD HH:mm". */
export function autoSaveCommitMessage(date: Date): string {
  return `Auto-save examen ${formatStamp(date)}`;
}

/** Mensaje de commit de entrega: "Entrega final examen YYYY-MM-DD HH:mm". */
export function finalSubmitCommitMessage(date: Date): string {
  return `Entrega final examen ${formatStamp(date)}`;
}

function formatStamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = p(date.getMonth() + 1);
  const dd = p(date.getDate());
  const hh = p(date.getHours());
  const min = p(date.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}
