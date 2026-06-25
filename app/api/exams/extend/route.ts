import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { extendExam } from "@/lib/services/exam.server";

export async function POST(req: Request) {
  const guard = await requireApiRole("teacher");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const examName = body?.examName as string | undefined;
  const minutes = Number(body?.minutes) || 0;
  if (!examName || minutes <= 0) {
    return NextResponse.json({ error: "Faltan examName/minutes" }, { status: 400 });
  }

  try {
    const result = await extendExam(examName, minutes);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al extender el examen";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
