import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";

/**
 * Valida el código docente para la exportación de emergencia (GitHub caído).
 * El código vive en la env EXPORT_CODE (server-side, no en el bundle).
 */
export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "");
  const expected = process.env.EXPORT_CODE ?? "";

  if (!expected || code !== expected) {
    return NextResponse.json({ error: "código inválido" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
