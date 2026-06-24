export type ExamStatus = "draft" | "open" | "closed";

/**
 * ExamService — orquesta el ciclo de vida del examen:
 * crear (DRAFT) → iniciar (OPEN) → cerrar (CLOSED).
 *
 * En este scaffolding están implementados los helpers puros (parseo de
 * usernames, transiciones de estado, patrón de nombres de repo). La
 * persistencia y la generación real de repos se completan en WOLL-012/013/014.
 */

/** Transiciones válidas del examen. No hay reapertura en Fase 1. */
export const EXAM_TRANSITIONS: Record<ExamStatus, ExamStatus[]> = {
  draft: ["open"],
  open: ["closed"],
  closed: [],
};

export function canTransitionExam(from: ExamStatus, to: ExamStatus): boolean {
  return EXAM_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Parsea la lista de usernames de GitHub que el docente pega al iniciar el
 * examen. Acepta separación por línea, coma o espacios. Normaliza a minúsculas,
 * remueve un eventual prefijo "@" y deduplica preservando el orden.
 */
export function parseUsernames(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const u = raw.trim().replace(/^@/, "").toLowerCase();
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/**
 * Normaliza el nombre del examen a un slug seguro para repo/URL:
 * minúsculas, espacios→guiones, solo [a-z0-9-], sin guiones repetidos ni en los bordes.
 */
export function sanitizeExamName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Construye el nombre del repo de un alumno a partir del patrón del examen.
 * Tokens soportados: {username}, {exam}, {org}.
 * Ej: "parcial2-comision1-{username}" → "parcial2-comision1-nahuellurbe".
 */
export function buildRepoName(
  pattern: string,
  vars: { username: string; exam?: string; org?: string },
): string {
  return pattern
    .replace(/\{username\}/g, vars.username)
    .replace(/\{exam\}/g, vars.exam ?? "")
    .replace(/\{org\}/g, vars.org ?? "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Normaliza la lista de paths editables aceptando solo .wlk / .wtest.
 * Acepta separación por línea o coma. Deduplica preservando el orden.
 */
export function sanitizeEditablePaths(input: string | string[]): string[] {
  const parts = Array.isArray(input) ? input : input.split(/[\n,]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const p = raw.trim().replace(/^\.\//, "");
    if (!p) continue;
    if (!/\.(wlk|wtest)$/i.test(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

// TODO(WOLL-012/013/014): clase ExamService con persistencia Supabase +
// GitHubIntegrationService (crear examen, iniciar, cerrar, validar accesos).
