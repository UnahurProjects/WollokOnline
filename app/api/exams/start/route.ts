import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { startExam } from "@/lib/services/exam.server";

export async function POST(req: Request) {
  const guard = await requireApiRole("teacher");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body?.examName || !body?.templateRepo) {
    return NextResponse.json(
      { error: "Faltan campos: examName, templateRepo" },
      { status: 400 },
    );
  }

  try {
    const result = await startExam({
      templateRepo: String(body.templateRepo),
      examName: String(body.examName),
      usernames: String(body.usernames ?? ""),
      autoCommitIntervalMinutes: Number(body.autoCommitIntervalMinutes) || 5,
      teacher: guard.session.user.githubUsername,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al iniciar el examen";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
