"use client";

import { useEffect, useState } from "react";
import { formatStampShort } from "@/lib/format";
import type { DashboardData, DashboardRow } from "@/lib/services/exam.server";

const GRACE_MIN = 5;

/**
 * Dashboard docente (GitHub-only): alumnos con último commit + IP + actividad,
 * leídos en lote (GraphQL). Refresco manual. Controles de cierre: cuenta
 * regresiva blanda (con cancelar) + cierre duro.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Reloj para el contador de la cuenta regresiva.
  useEffect(() => {
    if (!control.closingAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [control.closingAt]);

  const remainingMs = control.closingAt
    ? Math.max(0, new Date(control.closingAt).getTime() - now)
    : 0;
  const counting = !!control.closingAt && !control.closed;

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

  async function action(fn: () => Promise<Response>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo completar la acción");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
      setConfirmClose(false);
    }
  }

  const startCountdown = () =>
    action(() =>
      fetch("/api/exams/countdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName, action: "start", minutes: GRACE_MIN }),
      }),
    );
  const cancelCountdown = () =>
    action(() =>
      fetch("/api/exams/countdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName, action: "cancel" }),
      }),
    );
  const closeExam = () =>
    action(() =>
      fetch("/api/exams/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName }),
      }),
    );

  const mmss = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md border bd px-3 py-1.5 text-sm transition hoverable disabled:opacity-50"
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
          {control.closed ? (
            <span className="rounded-full border bd px-2 py-0.5 text-sm uppercase opacity-70">
              Cerrado
            </span>
          ) : counting ? (
            <span className="rounded-full border border-amber-400/50 px-2 py-0.5 text-sm text-amber-300">
              Cierra en {mmss(remainingMs)}
            </span>
          ) : (
            <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-sm text-emerald-300">
              Abierto
            </span>
          )}
        </div>

        {!control.closed && (
          <div className="flex flex-wrap items-center gap-2">
            {counting ? (
              <button
                onClick={cancelCountdown}
                disabled={busy}
                className="rounded-md border bd px-3 py-1.5 text-sm transition hoverable disabled:opacity-50"
              >
                Cancelar cuenta regresiva
              </button>
            ) : (
              <button
                onClick={startCountdown}
                disabled={busy}
                className="rounded-md border border-amber-400/50 px-3 py-1.5 text-sm text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-50"
              >
                Iniciar cuenta regresiva ({GRACE_MIN} min)
              </button>
            )}
            {confirmClose ? (
              <span className="flex items-center gap-2">
                <span className="text-sm opacity-70">¿Cerrar de verdad?</span>
                <button
                  onClick={closeExam}
                  disabled={busy}
                  className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmClose(false)}
                  className="rounded-md border bd px-3 py-1.5 text-sm hoverable"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmClose(true)}
                className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
              >
                Cerrar examen
              </button>
            )}
          </div>
        )}
      </div>

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
                  className={`border-t bd ${r.late ? "bg-red-500/10" : ""}`}
                >
                  <td className="px-3 py-2 font-mono">
                    {r.late && <span title="Sin commitear hace rato">⚠ </span>}
                    {r.username}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={r.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline opacity-80 hover:opacity-100"
                    >
                      {r.repoName}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    {r.activity === "entregado" ? (
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
