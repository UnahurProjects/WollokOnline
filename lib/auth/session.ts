import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { UserRole } from "@/lib/types/db";

/** Exige sesión iniciada; si no, redirige al login (home). */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.githubUsername) redirect("/");
  return session;
}

/** Exige un rol específico; si no coincide, redirige a la home del rol real. */
export async function requireRole(role: UserRole) {
  const session = await requireUser();
  if (session.user.role !== role) {
    redirect(session.user.role === "teacher" ? "/teacher" : "/student");
  }
  return session;
}
