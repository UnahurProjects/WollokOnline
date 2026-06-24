import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Login + confirmación de identidad.
 *
 * - Sin sesión: botón "Ingresar con GitHub" (reutiliza la sesión del navegador).
 * - Con sesión: "Bienvenido usuarioX", el usuario confirma su identidad y
 *   continúa a su home según rol. "No soy yo" cierra la sesión.
 *
 * La app nunca pide el username manualmente: se obtiene de GitHub.
 */
export default async function HomePage() {
  const session = await auth();

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div>
        <h1 className="text-3xl font-bold">Wollok Exam Online</h1>
        <p className="mt-2 text-sm opacity-70">
          Parciales de Wollok en un entorno controlado — UNAHUR
        </p>
      </div>

      {!session?.user?.githubUsername ? (
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md btn-primary px-4 py-3 text-sm font-semibold transition hover:opacity-90"
          >
            Ingresar con GitHub
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-5 rounded-lg border bd surface p-6">
          <div>
            <p className="text-lg">
              Bienvenido{" "}
              <span className="font-bold">{session.user.githubUsername}</span>
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide opacity-60">
              {session.user.role === "teacher" ? "Docente" : "Alumno"}
            </p>
          </div>

          <p className="text-sm opacity-70">¿Sos vos? Confirmá para continuar.</p>

          <div className="flex flex-col gap-3">
            <Link
              href={session.user.role === "teacher" ? "/teacher" : "/student"}
              className="w-full rounded-md btn-primary px-4 py-3 text-center text-sm font-semibold transition hover:opacity-90"
            >
              Sí, soy yo — continuar
            </Link>

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="w-full rounded-md border bd px-4 py-3 text-sm transition hoverable"
              >
                No soy yo (cerrar sesión)
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
