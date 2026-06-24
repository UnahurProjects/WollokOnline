/**
 * Docentes habilitados.
 *
 * En Fase 1 los docentes se definen por configuración (no en DB). El rol se
 * resuelve a partir del `github_username` autenticado vía Auth.js (WOLL-006).
 *
 * Se puede sobreescribir/extender con la env `TEACHERS` (lista separada por comas).
 */
const STATIC_TEACHERS: string[] = [
  // "usuario1",
  // "usuario2",
];

function fromEnv(): string[] {
  const raw = process.env.TEACHERS ?? "";
  return raw
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
}

/** Conjunto de usernames docentes, normalizados a minúsculas. */
export const TEACHERS: ReadonlySet<string> = new Set(
  [...STATIC_TEACHERS, ...fromEnv()].map((u) => u.toLowerCase()),
);

export function isTeacher(githubUsername: string | null | undefined): boolean {
  if (!githubUsername) return false;
  return TEACHERS.has(githubUsername.toLowerCase());
}
