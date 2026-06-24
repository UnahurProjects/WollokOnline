import { signOut } from "@/auth";
import { requireRole } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OpenDashboardForm } from "@/components/teacher/OpenDashboardForm";
import { StartExamForm } from "@/components/teacher/StartExamForm";

export default async function TeacherHome() {
  const session = await requireRole("teacher");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Panel docente</h1>
          <p className="text-sm opacity-60">{session.user.githubUsername}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="rounded-md border bd px-3 py-1.5 text-sm transition hoverable">
              Salir
            </button>
          </form>
        </div>
      </header>

      <section className="rounded-lg border bd surface p-5">
        <h2 className="mb-4 text-lg font-semibold">Iniciar examen</h2>
        <StartExamForm />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Ver un examen (en curso o cerrado)</h2>
        <OpenDashboardForm />
      </section>
    </main>
  );
}
