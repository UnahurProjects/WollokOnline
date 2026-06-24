"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatStampShort } from "@/lib/format";
import type { DashboardRow } from "@/lib/services/exam.server";

/**
 * Dashboard docente (GitHub-only): alumnos del examen con último commit + IP,
 * leídos en vivo de GitHub. Permite refrescar y cerrar el examen (archivar repos).
 */
export function ExamDashboard({
  examName,
  initial,
}: {
  examName: string;
  initial: DashboardRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<DashboardRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const closed = rows.length > 0 && rows.every((r) => r.archived);

  // Auto-refresh cada 15s (sin spinner), salvo que el examen esté cerrado.
  useEffect(() => {
    if (closed) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/exams/status?name=${encodeURIComponent(examName)}`);
        const data = await res.json();
        if (res.ok) setRows(data.rows as DashboardRow[]);
      } catch {
        // ignorar; reintenta en el próximo tick
      }
    }, 15000);
    return () => clearInterval(id);
  }, [examName, closed]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/status?name=${encodeURIComponent(examName)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar");
      setRows(data.rows as DashboardRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function close() {
    setClosing(true);
    setError(null);
    try {
      const res = await fetch("/api/exams/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cerrar");
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setClosing(false);
      setConfirmClose(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md border bd px-3 py-1.5 text-sm transition hoverable disabled:opacity-50"
          >
            {loading ? "Actualizando…" : "Actualizar (GitHub)"}
          </button>
          {closed && (
            <span className="rounded-full border bd px-2 py-0.5 text-xs uppercase opacity-70">
              Cerrado
            </span>
          )}
        </div>

        {!closed &&
          rows.length > 0 &&
          (confirmClose ? (
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">¿Cerrar? No se puede reabrir.</span>
              <button
                onClick={close}
                disabled={closing}
                className="rounded-md bg-red-500 px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {closing ? "Cerrando…" : "Confirmar"}
              </button>
              <button
                onClick={() => setConfirmClose(false)}
                className="rounded-md border bd px-3 py-1.5 text-sm hoverable"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClose(true)}
              className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
            >
              Cerrar examen
            </button>
          ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm opacity-60">No hay repos para este examen.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bd">
          <table className="w-full text-left text-sm">
            <thead className="surface text-xs uppercase opacity-60">
              <tr>
                <th className="px-3 py-2">Alumno</th>
                <th className="px-3 py-2">Repo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Último commit</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.repoName} className="border-t bd">
                  <td className="px-3 py-2 font-mono">{r.username}</td>
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
                  <td className="px-3 py-2">{r.archived ? "cerrado" : "abierto"}</td>
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
