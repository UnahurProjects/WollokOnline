import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getDashboard } from "@/lib/services/exam.server";

export async function GET(req: Request) {
  const guard = await requireApiRole("teacher");
  if ("response" in guard) return guard.response;

  const name = new URL(req.url).searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Falta name" }, { status: 400 });

  try {
    const rows = await getDashboard(name);
    return NextResponse.json({ rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al leer el estado";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
