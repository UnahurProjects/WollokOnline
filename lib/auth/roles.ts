import { isTeacher } from "@/lib/config/teachers";
import type { UserRole } from "@/lib/types/db";

/**
 * Resuelve el rol a partir del github_username autenticado.
 * En Fase 1 los docentes se definen por configuración (lib/config/teachers.ts).
 */
export function resolveRole(username: string | null | undefined): UserRole {
  return isTeacher(username) ? "teacher" : "student";
}
