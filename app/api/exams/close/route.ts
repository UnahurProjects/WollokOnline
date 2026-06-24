import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { closeExam } from "@/lib/services/exam.server";

export async function POST(req: Request) {
  const guard = await requireApiRole("teacher");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body?.examName) {
    return NextResponse.json({ error: "Falta examName" }, { status: 400 });
  }

  try {
    const result = await closeExam(String(body.examName));
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al cerrar el examen";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
