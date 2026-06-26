import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { createExamBatch } from "@/lib/services/exam.server";

// Una tanda corta de creación de repos. La app docente las manda de a una marcando
// el ritmo; cada request debe terminar dentro del límite de tiempo de Vercel.
export const maxDuration = 60;

export async function POST(req: Request) {
  const guard = await requireApiRole("teacher");
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body?.examName || !body?.templateRepo || !Array.isArray(body?.usernames)) {
    return NextResponse.json(
      { error: "Faltan campos: examName, templateRepo, usernames" },
      { status: 400 },
    );
  }

  try {
    const result = await createExamBatch({
      examName: String(body.examName),
      templateRepo: String(body.templateRepo),
      usernames: body.usernames.map(String),
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al crear los repos";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
