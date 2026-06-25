import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { cancelCountdown, startCountdown } from "@/lib/services/exam.server";

export async function POST(req: Request) {
  const guard = await requireApiRole("teacher");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const examName = body?.examName as string | undefined;
  const action = body?.action as string | undefined;
  if (!examName) return NextResponse.json({ error: "Falta examName" }, { status: 400 });

  try {
    if (action === "cancel") {
      await cancelCountdown(examName);
      return NextResponse.json({ ok: true, closingAt: null });
    }
    const minutes = Number(body?.minutes) || 5;
    const result = await startCountdown(examName, minutes);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error en la cuenta regresiva";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
