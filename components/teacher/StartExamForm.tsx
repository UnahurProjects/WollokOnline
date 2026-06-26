"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const field =
  "w-full rounded-md border bd bg-black/20 px-3 py-2 text-sm outline-none focus:border-current";
const label = "text-xs uppercase tracking-wide opacity-60";

// La app crea los repos en tandas: cada request es corto (entra en el timeout de
// Vercel) y entre tandas se respeta el ritmo (≤80 creaciones/min de GitHub).
const BATCH = 50; // repos por request (~30s al crear; margen bajo el límite de Vercel)
const MIN_BATCH_INTERVAL_MS = 45_000; // ≥45s entre inicios de tanda → ~65/min

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Inicia un examen en un solo paso: genera un repo privado por alumno desde el
 * template (generate-from-template). No hay borrador en base de datos.
 */
export function StartExamForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<{ repo: string; path: string; content: string } | null>(
    null,
  );
  const [pendingAppend, setPendingAppend] = useState<{
    examName: string;
    newUsernames: string[];
    alreadyIn: string[];
  } | null>(null);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    failed: number;
  } | null>(null);
  const [starting, setStarting] = useState(false);

  // Valores del form, guardados al enviar (para reusarlos si hay que confirmar "agregar").
  const valuesRef = useRef<{
    examName: string;
    templateRepo: string;
    autoCommitIntervalMinutes: number;
    durationMinutes: number;
    usernames: string;
  } | null>(null);

  // Crea los repos en tandas (cada tanda = un request corto), marcando el ritmo.
  async function createReposInBatches(
    examName: string,
    templateRepo: string,
    usernames: string[],
  ) {
    const batches = chunk(usernames, BATCH);
    let done = 0;
    let failed = 0;
    setProgress({ done: 0, total: usernames.length, failed: 0 });
    for (let b = 0; b < batches.length; b++) {
      const t0 = Date.now();
      const res = await fetch("/api/exams/create-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName, templateRepo, usernames: batches[b] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear una tanda de repos");
      done += batches[b].length;
      failed += data.failed?.length ?? 0;
      setProgress({ done, total: usernames.length, failed });
      // Ritmo: no arrancar la próxima tanda antes de completar el intervalo (≤80/min).
      if (b < batches.length - 1) {
        const elapsed = Date.now() - t0;
        if (elapsed < MIN_BATCH_INTERVAL_MS) await sleep(MIN_BATCH_INTERVAL_MS - elapsed);
      }
    }
    router.push(`/teacher/exam/${examName}`);
  }

  async function attemptStart(confirmAddToExisting: boolean) {
    const v = valuesRef.current;
    if (!v) return;
    setError(null);
    setManual(null);
    setPendingAppend(null);
    setProgress(null);
    setStarting(true);
    try {
      // 1) Crear el examen (o agregar usuarios): escribe solo el control central.
      const startRes = await fetch("/api/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examName: v.examName,
          autoCommitIntervalMinutes: v.autoCommitIntervalMinutes,
          durationMinutes: v.durationMinutes,
          usernames: v.usernames,
          confirmAddToExisting,
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        // GitHub caído al crear el control: ofrecemos el archivo para cargarlo a mano.
        if (startData.manualControl) {
          setManual(startData.manualControl);
          setStarting(false);
          return;
        }
        // El examen ya existe y está abierto: pedir confirmación para agregar usuarios.
        if (startData.examExists === "open") {
          setPendingAppend({
            examName: startData.examName,
            newUsernames: startData.newUsernames ?? [],
            alreadyIn: startData.alreadyIn ?? [],
          });
          setStarting(false);
          return;
        }
        // Ya existe y está cerrado: no se puede agregar.
        if (startData.examExists === "closed") {
          setError(
            `El examen "${startData.examName}" ya existe y está cerrado. Elegí otro nombre.`,
          );
          setStarting(false);
          return;
        }
        throw new Error(startData.error ?? "No se pudo crear el examen");
      }

      // 2) Crear los repos que devuelve (todos si es nuevo; solo los nuevos si se agregó).
      const toCreate: string[] = startData.roster ?? [];
      if (toCreate.length === 0) {
        router.push(`/teacher/exam/${startData.examName}`);
        return;
      }
      await createReposInBatches(startData.examName, v.templateRepo, toCreate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setStarting(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    valuesRef.current = {
      examName: String(fd.get("examName")),
      templateRepo: String(fd.get("templateRepo")),
      autoCommitIntervalMinutes: Number(fd.get("autoCommitIntervalMinutes")),
      durationMinutes: Number(fd.get("durationMinutes")),
      usernames: String(fd.get("usernames") ?? ""),
    };
    attemptStart(false);
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

      {manual && (
        <div className="rounded-md border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
          <p className="font-semibold text-amber-300">
            No se pudo crear el examen (GitHub no respondió).
          </p>
          <p className="mt-1 opacity-80">
            Cargalo a mano: en la org, repo <code className="font-mono">{manual.repo}</code>, creá
            el archivo <code className="font-mono">{manual.path}</code> con este contenido:
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-black/30 p-2 font-mono text-xs">
            {manual.content}
          </pre>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(manual.content)}
            className="mt-2 rounded-md border border-amber-400/50 px-3 py-1 text-xs text-amber-300 hover:bg-amber-400/10"
          >
            📋 Copiar contenido
          </button>
        </div>
      )}

      {pendingAppend && (
        <div className="rounded-md border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
          <p className="font-semibold text-amber-300">
            El examen &quot;{pendingAppend.examName}&quot; ya existe y está abierto.
          </p>
          {pendingAppend.newUsernames.length > 0 ? (
            <>
              <p className="mt-1 opacity-80">
                Se agregarían <strong>{pendingAppend.newUsernames.length}</strong> usuario(s)
                nuevo(s)
                {pendingAppend.alreadyIn.length > 0 &&
                  ` (${pendingAppend.alreadyIn.length} ya estaban)`}
                . <strong>No</strong> se cambia la hora de fin ni el resto del examen.
              </p>
              <p className="mt-1 font-mono text-xs opacity-60">
                {pendingAppend.newUsernames.join(", ")}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => attemptStart(true)}
                  disabled={starting}
                  className="rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
                >
                  Sí, agregar al examen abierto
                </button>
                <button
                  type="button"
                  onClick={() => setPendingAppend(null)}
                  className="rounded-md border bd px-3 py-1 text-xs hoverable"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <p className="mt-1 opacity-80">
              Todos los usuarios que pusiste ya estaban en este examen. No hay nada para
              agregar.
            </p>
          )}
        </div>
      )}

      {progress && (
        <p className="text-sm opacity-80">
          Creando repos… {progress.done}/{progress.total}
          {progress.failed > 0 && (
            <span className="text-red-400">
              {" "}
              · {progress.failed} fallaron (se crean a mano desde el dashboard)
            </span>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={starting}
        className="self-start rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
      >
        {starting
          ? progress
            ? `Creando repos… ${progress.done}/${progress.total}`
            : "Creando examen…"
          : "Iniciar examen (generar repos)"}
      </button>
    </form>
  );
}
