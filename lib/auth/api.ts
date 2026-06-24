import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import type { UserRole } from "@/lib/types/db";

type Guard = { session: Session } | { response: NextResponse };

/** Exige sesión iniciada en un Route Handler. */
export async function requireApiUser(): Promise<Guard> {
  const session = await auth();
  if (!session?.user?.githubUsername) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { session };
}

/** Exige un rol específico en un Route Handler. */
export async function requireApiRole(role: UserRole): Promise<Guard> {
  const guard = await requireApiUser();
  if ("response" in guard) return guard;
  if (guard.session.user.role !== role) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return guard;
}
