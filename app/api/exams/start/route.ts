import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { ExamControlError, ExamExistsError, startExam } from "@/lib/services/exam.server";

export async function POST(req: Request) {
  const guard = await requireApiRole("teacher");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body?.examName) {
    return NextResponse.json({ error: "Falta el campo examName" }, { status: 400 });
  }

  try {
    const result = await startExam({
      examName: String(body.examName),
      usernames: String(body.usernames ?? ""),
      autoCommitIntervalMinutes: Number(body.autoCommitIntervalMinutes) || 10,
      durationMinutes: Number(body.durationMinutes) || 0,
      templateRepo: String(body.templateRepo ?? ""),
      confirmAddToExisting: !!body.confirmAddToExisting,
      teacher: guard.session.user.githubUsername,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ExamExistsError) {
      return NextResponse.json(
        {
          error: e.message,
          examExists: e.kind,
          examName: e.examName,
          newUsernames: e.newUsernames,
          alreadyIn: e.alreadyIn,
        },
        { status: 409 },
      );
    }
    if (e instanceof ExamControlError) {
      return NextResponse.json(
        { error: e.message, manualControl: e.manualControl },
        { status: 502 },
      );
    }
    const message = e instanceof Error ? e.message : "Error al iniciar el examen";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
