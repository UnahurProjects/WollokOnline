"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface ExamSummary {
  slug: string;
  closed: boolean;
  endsAt: string | null;
  startedAt: string | null;
  rosterCount: number;
  createdBy: string | null;
}

/** Lista los parciales (prioriza los ABIERTOS) leídos de `_control`, con estado de carga. */
export function OpenExamsList() {
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/exams/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron listar los parciales");
      setExams(data.exams as ExamSummary[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (exams ?? []).filter((e) => !e.closed);
  const closed = (exams ?? []).filter((e) => e.closed);
  const now = Date.now();

  const endLabel = (e: ExamSummary) => {
    if (!e.endsAt) return "Sin límite de tiempo";
    const ms = new Date(e.endsAt).getTime() - now;
    if (ms <= 0) return "Tiempo cumplido";
    const min = Math.round(ms / 60000);
    return min >= 60 ? `Termina en ${Math.floor(min / 60)}h ${min % 60}m` : `Termina en ${min} min`;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Parciales abiertos</h2>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border bd px-2.5 py-1 text-xs transition hoverable disabled:opacity-50"
        >
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </div>

      {loading && exams === null ? (
        <p className="text-sm opacity-60">Cargando parciales…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : open.length === 0 ? (
        <p className="text-sm opacity-60">No hay parciales abiertos.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {open.map((e) => {
            const timeUp = !!e.endsAt && new Date(e.endsAt).getTime() - now <= 0;
            return (
              <li key={e.slug}>
                <Link
                  href={`/teacher/exam/${encodeURIComponent(e.slug)}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-sm transition hover:bg-emerald-400/10"
                >
                  <span className="font-mono font-medium">{e.slug}</span>
                  <span className="flex items-center gap-3 text-xs opacity-70">
                    <span>{e.rosterCount} alumno(s)</span>
                    <span className={timeUp ? "text-red-300" : "text-amber-300"}>
                      {endLabel(e)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {closed.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-sm opacity-60 hover:opacity-100">
            Cerrados ({closed.length})
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {closed.map((e) => (
              <li key={e.slug}>
                <Link
                  href={`/teacher/exam/${encodeURIComponent(e.slug)}`}
                  className="flex items-center justify-between gap-3 rounded-md border bd px-3 py-1.5 text-sm opacity-70 transition hover:opacity-100"
                >
                  <span className="font-mono">{e.slug}</span>
                  <span className="text-xs uppercase opacity-60">Cerrado</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
