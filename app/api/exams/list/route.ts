import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { listExams } from "@/lib/services/control.server";

// Lista los exámenes (abiertos y cerrados) leyendo el repo `_control`. Puede tardar
// si hay muchos: la UI lo carga con su propio indicador de "cargando".
export const maxDuration = 60;

export async function GET() {
  const guard = await requireApiRole("teacher");
  if ("response" in guard) return guard.response;

  try {
    const exams = await listExams();
    return NextResponse.json({ exams });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al listar los exámenes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
