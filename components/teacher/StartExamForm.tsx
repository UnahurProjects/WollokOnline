"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const field =
  "w-full rounded-md border bd bg-black/20 px-3 py-2 text-sm outline-none focus:border-current";
const label = "text-xs uppercase tracking-wide opacity-60";

/**
 * Inicia un examen en un solo paso: genera un repo privado por alumno desde el
 * template (generate-from-template). No hay borrador en base de datos.
 */
export function StartExamForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStarting(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examName: fd.get("examName"),
          templateRepo: fd.get("templateRepo"),
          autoCommitIntervalMinutes: Number(fd.get("autoCommitIntervalMinutes")),
          durationMinutes: Number(fd.get("durationMinutes")),
          usernames: String(fd.get("usernames") ?? ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar el examen");
      router.push(`/teacher/exam/${data.examName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setStarting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={label}>Nombre del examen</label>
          <input name="examName" required className={field} placeholder="parcial2-com1" />
          <span className="text-xs opacity-50">
            Sin espacios. Los alumnos lo ingresan a mano para entrar.
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>Repo template</label>
          <input
            name="templateRepo"
            required
            className={field}
            placeholder="wollok-parcial-template"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={label}>Auto-commit (min)</label>
          <select name="autoCommitIntervalMinutes" defaultValue="10" className={field}>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="20">20</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={label}>Duración (min)</label>
          <input
            name="durationMinutes"
            type="number"
            min={0}
            defaultValue={120}
            className={field}
          />
          <span className="text-xs opacity-50">0 = sin límite de tiempo.</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className={label}>Usuarios de GitHub presentes</label>
        <textarea
          name="usernames"
          rows={6}
          required
          className={`${field} font-mono`}
          placeholder={"alumno1\nalumno2\nalumno3"}
        />
        <span className="text-xs opacity-50">Uno por línea o separados por coma.</span>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={starting}
        className="self-start rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
      >
        {starting ? "Generando repos…" : "Iniciar examen (generar repos)"}
      </button>
    </form>
  );
}
