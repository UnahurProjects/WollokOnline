"use client";

import { useEffect, useState } from "react";
import { formatStampShort } from "@/lib/format";
import type { DashboardData, DashboardRow } from "@/lib/services/exam.server";

const EXTEND_MIN = 15;

/**
 * Dashboard docente (GitHub-only): alumnos con último commit + IP + actividad,
 * leídos en lote (GraphQL). Refresco manual. Controles: extender tiempo + finalizar.
 */
export function ExamDashboard({
  examName,
  initial,
}: {
  examName: string;
  initial: DashboardData;
}) {
  const [rows, setRows] = useState<DashboardRow[]>(initial.rows);
  const [control, setControl] = useState(initial.control);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<null | "extend" | "close">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // El contador depende de la hora actual, que difiere entre el render del
  // servidor y la hidratación del cliente. Hasta montar mostramos un placeholder
  // estable para evitar el desajuste de hidratación.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Reloj para el contador (si hay hora de fin).
  useEffect(() => {
    if (!control.endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [control.endsAt]);

  const remainingMs = control.endsAt
    ? Math.max(0, new Date(control.endsAt).getTime() - now)
    : 0;
  const hasEnd = !!control.endsAt && !control.closed;
  const timeUp = mounted && hasEnd && remainingMs <= 0;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/status?name=${encodeURIComponent(examName)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar");
      setRows(data.rows);
      setControl(data.control);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  // Una acción a la vez: marca cuál está en curso (para el texto del botón) y
  // bloquea el resto hasta terminar (evita doble click / pisar acciones).
  async function action(kind: "extend" | "close", fn: () => Promise<Response>) {
    if (busyAction) return;
    setBusyAction(kind);
    setError(null);
    try {
      const res = await fn();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo completar la acción");
      await refresh();
      setConfirmClose(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusyAction(null);
    }
  }

  const extend = () =>
    action("extend", () =>
      fetch("/api/exams/extend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName, minutes: EXTEND_MIN }),
      }),
    );
  const closeExam = () =>
    action("close", () =>
      fetch("/api/exams/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName }),
      }),
    );

  // Cualquier operación en curso bloquea todos los controles.
  const anyBusy = loading || busyAction !== null;

  const fmt = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={anyBusy}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            <span aria-hidden className={loading ? "animate-spin" : ""}>
              ↻
            </span>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
          {control.closed ? (
            <span className="rounded-full border bd px-2 py-0.5 text-sm uppercase opacity-70">
              Cerrado
            </span>
          ) : timeUp ? (
            <span className="rounded-full border border-red-500/50 px-2 py-0.5 text-sm text-red-300">
              Tiempo cumplido
            </span>
          ) : hasEnd ? (
            <span className="rounded-full border border-amber-400/50 px-2 py-0.5 text-sm text-amber-300">
              Termina en {mounted ? fmt(remainingMs) : "…"}
            </span>
          ) : (
            <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-sm text-emerald-300">
              Abierto (sin límite)
            </span>
          )}
        </div>

        {!control.closed && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={extend}
              disabled={anyBusy}
              className="rounded-md border border-amber-400/50 px-3 py-1.5 text-sm text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-50"
            >
              {busyAction === "extend" ? "Extendiendo…" : `Extender +${EXTEND_MIN} min`}
            </button>
            {confirmClose ? (
              <span className="flex items-center gap-2">
                <span className="text-sm opacity-70">¿Finalizar de verdad?</span>
                <button
                  onClick={closeExam}
                  disabled={anyBusy}
                  className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
                >
                  {busyAction === "close" ? "Finalizando…" : "Confirmar"}
                </button>
                <button
                  onClick={() => setConfirmClose(false)}
                  disabled={anyBusy}
                  className="rounded-md border bd px-3 py-1.5 text-sm hoverable disabled:opacity-50"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmClose(true)}
                disabled={anyBusy}
                className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                Finalizar examen
              </button>
            )}
          </div>
        )}
      </div>

      {busyAction && (
        <p className="text-sm text-amber-300">
          {busyAction === "extend"
            ? "Extendiendo el tiempo… esperá, no cierres ni recargues."
            : "Finalizando el examen… esperá, no cierres ni recargues."}
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm opacity-60">No hay repos para este examen.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bd">
          <table className="w-full text-left text-sm">
            <thead className="surface text-sm uppercase opacity-60">
              <tr>
                <th className="px-3 py-2">Alumno</th>
                <th className="px-3 py-2">Repo</th>
                <th className="px-3 py-2">Actividad</th>
                <th className="px-3 py-2">Último commit</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.repoName}
                  className={`border-t bd ${
                    r.missing ? "bg-red-500/15" : r.late ? "bg-red-500/10" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-mono">
                    {r.missing && <span title="Sin repo — crear a mano">✖ </span>}
                    {r.late && !r.missing && <span title="Sin commitear hace rato">⚠ </span>}
                    {r.username}
                  </td>
                  <td className="px-3 py-2">
                    {r.repoUrl ? (
                      <a
                        href={r.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline opacity-80 hover:opacity-100"
                      >
                        {r.repoName}
                      </a>
                    ) : (
                      <span
                        className="font-mono text-red-300"
                        title="Creá este repo desde el template (Use this template)"
                      >
                        {r.repoName} <span className="opacity-60">(crear a mano)</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.missing ? (
                      <span className="text-red-300">Falta el repo</span>
                    ) : r.activity === "entregado" ? (
                      <span className="text-blue-600 dark:text-blue-300">Entregado</span>
                    ) : r.activity === "trabajando" ? (
                      <span className="text-emerald-700 dark:text-emerald-300">
                        Trabajando
                      </span>
                    ) : (
                      <span className="opacity-50">Sin actividad</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatStampShort(r.lastCommitAt)}</td>
                  <td className="px-3 py-2 font-mono">{r.lastCommitIp ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
