import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { OpenDashboardForm } from "@/components/teacher/OpenDashboardForm";
import { OpenExamsList } from "@/components/teacher/OpenExamsList";

/**
 * Hub de dashboards: elegir qué examen ver. Acá (y solo acá) se cargan los
 * parciales abiertos — no en la home, para no buscar cuando solo querés iniciar uno.
 */
export default async function TeacherDashboardHub() {
  await requireRole("teacher");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">
      <div className="flex items-center gap-3">
        <Link href="/teacher" className="text-sm opacity-60 hover:opacity-100">
          ← Volver al panel
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm opacity-60">Ver un examen en curso o cerrado.</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Ver un examen por nombre</h2>
        <OpenDashboardForm />
      </section>

      <section className="rounded-lg border bd surface p-5">
        <OpenExamsList />
      </section>
    </main>
  );
}
