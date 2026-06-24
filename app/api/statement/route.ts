import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { AccessError, getStatementImageForStudent } from "@/lib/services/student.server";

export async function GET(req: Request) {
  const guard = await requireApiUser();
  if ("response" in guard) return guard.response;

  const exam = new URL(req.url).searchParams.get("exam");
  if (!exam) return NextResponse.json({ error: "Falta exam" }, { status: 400 });

  try {
    const img = await getStatementImageForStudent(exam, guard.session.user.githubUsername);
    if (!img) return new NextResponse(null, { status: 404 });
    return new NextResponse(img.data as BodyInit, {
      headers: {
        "Content-Type": img.contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const message = e instanceof Error ? e.message : "Error al cargar el enunciado";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
