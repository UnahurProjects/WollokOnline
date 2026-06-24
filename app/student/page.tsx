import { signOut } from "@/auth";
import { requireRole } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StudentExamEntry } from "@/components/student/StudentExamEntry";

export default async function StudentHome() {
  const session = await requireRole("student");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wollok Exam</h1>
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

      <div className="rounded-lg border bd surface p-6">
        <StudentExamEntry />
      </div>
    </main>
  );
}
