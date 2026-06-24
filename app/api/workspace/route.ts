import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { AccessError, getStudentWorkspace } from "@/lib/services/student.server";

export async function GET(req: Request) {
  const guard = await requireApiUser();
  if ("response" in guard) return guard.response;

  const exam = new URL(req.url).searchParams.get("exam");
  if (!exam) return NextResponse.json({ error: "Falta exam" }, { status: 400 });

  try {
    const workspace = await getStudentWorkspace(exam, guard.session.user.githubUsername);
    return NextResponse.json(workspace);
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Error al cargar el workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
