import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getDashboard } from "@/lib/services/exam.server";
import { sanitizeExamName } from "@/lib/services/exam.service";
import { ExamDashboard } from "@/components/teacher/ExamDashboard";
import type { DashboardRow } from "@/lib/services/exam.server";

export default async function ExamDashboardPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  await requireRole("teacher");
  const { name } = await params;
  const slug = sanitizeExamName(decodeURIComponent(name));

  let rows: DashboardRow[] = [];
  let error: string | null = null;
  try {
    rows = await getDashboard(slug);
  } catch (e) {
    error = e instanceof Error ? e.message : "No se pudo cargar el examen";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center gap-3">
        <Link href="/teacher" className="text-sm opacity-60 hover:opacity-100">
          ← Volver
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-bold">{slug}</h1>
        <p className="text-sm opacity-60">{rows.length} alumno(s)</p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <ExamDashboard examName={slug} initial={rows} />
      )}
    </main>
  );
}
