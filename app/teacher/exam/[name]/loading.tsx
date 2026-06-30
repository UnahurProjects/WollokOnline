/** Indicador mientras el servidor arma el dashboard (lista repos + últimos commits). */
export default function LoadingExamDashboard() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="text-sm opacity-60">← Volver</div>
      <header>
        <div className="h-7 w-48 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <p className="mt-2 text-sm opacity-60">Cargando examen… leyendo repos y commits.</p>
      </header>
      <div className="h-40 animate-pulse rounded-lg border bd bg-black/5 dark:bg-white/5" />
    </main>
  );
}
