import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { commitStudentWork } from "@/lib/services/commit.server";
import { AccessError } from "@/lib/services/student.server";
import type { WorkspaceFile } from "@/lib/services/types";
import { getClientIp } from "@/lib/server/ip";

export async function POST(req: Request) {
  const guard = await requireApiUser();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  const exam = body?.exam as string | undefined;
  const files = (body?.files as WorkspaceFile[] | undefined) ?? [];
  if (!exam) return NextResponse.json({ error: "Falta exam" }, { status: 400 });

  try {
    const result = await commitStudentWork(
      exam,
      guard.session.user.githubUsername,
      files,
      "final",
      getClientIp(req),
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Error al entregar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
