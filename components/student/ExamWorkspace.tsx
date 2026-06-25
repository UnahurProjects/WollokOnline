"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatStampShort } from "@/lib/format";
import type { ActivityEventInput } from "@/lib/services/activity-logging";
import {
  appendActivityEvents,
  getLocalWorkspace,
  isLocalNewer,
  setLocalWorkspace,
  type LocalFile,
} from "@/lib/local/db";
import type { ActivityEventType } from "@/lib/types/db";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RecoveryDialog } from "./RecoveryDialog";
import { StatementPanel } from "./StatementPanel";
import { WollokConsole } from "./WollokConsole";
import { WollokEditor } from "./WollokEditor";

interface WorkspaceResponse {
  examName: string;
  repoName: string;
  repoUrl: string;
  autoCommitIntervalMinutes: number;
  statementImageUrl: string | null;
  files: LocalFile[];
  lastCommitAt: string | null;
}

type Phase = "loading" | "recovery" | "ready" | "error";

const SAVE_DEBOUNCE_MS = 800;

/** ¿Tienen el mismo contenido (mismos paths y mismo texto)? */
function filesEqual(a: LocalFile[], b: LocalFile[]): boolean {
  if (a.length !== b.length) return false;
  const m = new Map(a.map((f) => [f.path, f.content]));
  return b.every((f) => m.get(f.path) === f.content);
}

export function ExamWorkspace({
  examName,
  username,
}: {
  examName: string;
  username: string;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [remote, setRemote] = useState<WorkspaceResponse | null>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [lastLocalSaveAt, setLastLocalSaveAt] = useState<string | null>(null);
  const [lastCommitAt, setLastCommitAt] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitMsg, setCommitMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [recovery, setRecovery] = useState<{
    localSavedAt: string;
    localFiles: LocalFile[];
  } | null>(null);
  const [consoleHeight, setConsoleHeight] = useState(280);
  const [closed, setClosed] = useState(false);
  const [showStatement, setShowStatement] = useState(true);
  const [showFiles, setShowFiles] = useState(true);
  const [statementWidth, setStatementWidth] = useState(480);
  const [showExport, setShowExport] = useState(false);
  const [exportCode, setExportCode] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const mainRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggedLengths = useRef<Map<string, number>>(new Map());
  const filesRef = useRef<LocalFile[]>([]);
  const submittedRef = useRef(false);
  const closedRef = useRef(false);
  const openCommitRef = useRef(false);
  const autoCommitRef = useRef<() => void>(() => {});
  filesRef.current = files;
  submittedRef.current = submitted;
  closedRef.current = closed;

  const localKey = examName;

  const log = useCallback(
    (events: ActivityEventInput[]) => {
      void appendActivityEvents(localKey, username, events).catch(() => {});
    },
    [localKey, username],
  );

  const onActivity = useCallback(
    (type: ActivityEventType) => log([{ type, ts: new Date().toISOString() }]),
    [log],
  );

  const persistLocal = useCallback(
    async (next: LocalFile[]) => {
      const now = new Date().toISOString();
      await setLocalWorkspace({
        examId: localKey,
        files: next,
        lastLocalSaveAt: now,
        lastCommitAt,
      });
      setLastLocalSaveAt(now);
    },
    [localKey, lastCommitAt],
  );

  const adopt = useCallback((next: LocalFile[]) => {
    setFiles(next);
    setActivePath((prev) => prev ?? next[0]?.path ?? null);
    loggedLengths.current = new Map(next.map((f) => [f.path, f.content.length]));
    setPhase("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/workspace?exam=${encodeURIComponent(examName)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo cargar el examen");
        if (cancelled) return;

        const ws = data as WorkspaceResponse;
        setRemote(ws);
        setLastCommitAt(ws.lastCommitAt);

        const local = await getLocalWorkspace(localKey);
        if (cancelled) return;

        // Solo ofrecer recuperación si la copia local tiene archivos (evita
        // recuperar un snapshot vacío guardado por error durante una carga previa).
        if (
          local &&
          local.files.length > 0 &&
          isLocalNewer(local.lastLocalSaveAt, ws.lastCommitAt) &&
          !filesEqual(local.files, ws.files)
        ) {
          setRecovery({ localSavedAt: local.lastLocalSaveAt, localFiles: local.files });
          setPhase("recovery");
          return;
        }

        await setLocalWorkspace({
          examId: localKey,
          files: ws.files,
          lastLocalSaveAt: new Date().toISOString(),
          lastCommitAt: ws.lastCommitAt,
        });
        adopt(ws.files);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error inesperado");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examName, localKey, adopt]);

  useEffect(() => {
    // No persistir si todavía no hay archivos cargados (evita pisar la copia
    // buena con un estado vacío al recargar durante la carga/recuperación).
    const flush = () => {
      if (filesRef.current.length > 0) void persistLocal(filesRef.current);
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [persistLocal]);

  function onEditorChange(path: string, value: string) {
    if (submittedRef.current) return;
    const next = filesRef.current.map((f) =>
      f.path === path ? { ...f, content: value } : f,
    );
    setFiles(next);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const prevLen = loggedLengths.current.get(path) ?? 0;
      const delta = value.length - prevLen;
      loggedLengths.current.set(path, value.length);
      log([
        {
          type: delta < 0 ? "delete" : "edit",
          ts: new Date().toISOString(),
          file: path,
          added: Math.max(0, delta),
          removed: Math.max(0, -delta),
        },
      ]);
      void persistLocal(next);
    }, SAVE_DEBOUNCE_MS);
  }

  const runCommit = useCallback(
    async (
      kind: "autosave" | "manual" | "final",
      endpoint: "/api/commit" | "/api/submit",
    ) => {
      if (submittedRef.current || closedRef.current) return;
      setCommitting(true);
      setCommitMsg(null);
      try {
        await persistLocal(filesRef.current);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exam: examName, files: filesRef.current, kind }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo sincronizar");

        setLastCommitAt(data.committedAt);
        await setLocalWorkspace({
          examId: localKey,
          files: filesRef.current,
          lastLocalSaveAt: new Date().toISOString(),
          lastCommitAt: data.committedAt,
        });

        if (kind === "final") {
          submittedRef.current = true;
          setSubmitted(true);
          log([{ type: "final_submit", ts: new Date().toISOString() }]);
          setCommitMsg("Entrega registrada ✓");
        } else {
          log([
            {
              type: kind === "manual" ? "manual_save" : "autosave",
              ts: new Date().toISOString(),
            },
          ]);
          setCommitMsg("Sincronizado ✓");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al sincronizar";
        if (/cerrad/i.test(msg)) {
          setClosed(true);
          closedRef.current = true;
        }
        setCommitMsg(msg);
      } finally {
        setCommitting(false);
      }
    },
    [examName, localKey, log, persistLocal],
  );

  autoCommitRef.current = () => void runCommit("autosave", "/api/commit");

  useEffect(() => {
    if (phase !== "ready" || submitted) return;
    const minutes = remote?.autoCommitIntervalMinutes ?? 5;
    const id = setInterval(() => autoCommitRef.current(), minutes * 60_000);
    return () => clearInterval(id);
  }, [phase, submitted, remote]);

  // Commit inicial al abrir → marca "presente" en el dashboard (hora + IP) apenas
  // el alumno entra, sin esperar al primer auto-commit.
  useEffect(() => {
    if (phase !== "ready" || submitted || closed) return;
    if (openCommitRef.current) return;
    openCommitRef.current = true;
    void runCommit("autosave", "/api/commit");
  }, [phase, submitted, closed, runCommit]);

  // Detecta si el docente cerró el examen (repo archivado) y bloquea la UI.
  useEffect(() => {
    if (phase !== "ready") return;
    const id = setInterval(async () => {
      if (submittedRef.current || closedRef.current) return;
      try {
        const res = await fetch(`/api/workspace?exam=${encodeURIComponent(examName)}`);
        if (res.status === 403) {
          setClosed(true);
          closedRef.current = true;
        }
      } catch {
        // ignorar; reintenta en el próximo tick
      }
    }, 45000);
    return () => clearInterval(id);
  }, [phase, examName]);

  async function onRecover() {
    if (!recovery) return;
    // Defensa: si por alguna razón la copia local está vacía, usar la de GitHub.
    const next = recovery.localFiles.length > 0 ? recovery.localFiles : (remote?.files ?? []);
    if (recovery.localFiles.length > 0) {
      log([{ type: "local_recovery_used", ts: new Date().toISOString() }]);
    }
    await persistLocal(next);
    adopt(next);
    setRecovery(null);
  }

  async function onUseRemote() {
    if (!remote) return;
    await persistLocal(remote.files);
    adopt(remote.files);
    setRecovery(null);
  }

  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => {
      const rect = sectionRef.current?.getBoundingClientRect();
      if (!rect) return;
      const h = rect.bottom - ev.clientY;
      setConsoleHeight(Math.min(Math.max(h, 100), rect.height - 120));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function onStatementResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => {
      const rect = mainRef.current?.getBoundingClientRect();
      if (!rect) return;
      const w = rect.right - ev.clientX;
      setStatementWidth(Math.min(Math.max(w, 240), rect.width - 320));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Exportación de emergencia (GitHub caído): descarga un .zip con los .wlk/.wtest
  // actuales (copia local), gateada por un código docente validado server-side.
  async function doExport(e: React.FormEvent) {
    e.preventDefault();
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/export-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: exportCode }),
      });
      if (!res.ok) {
        setExportError("Código incorrecto.");
        setExporting(false);
        return;
      }
      const wlk = filesRef.current.filter((f) => /\.(wlk|wtest)$/i.test(f.path));
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const f of wlk) zip.file(f.path, f.content);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${examName}-${username}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setShowExport(false);
      setExportCode("");
    } catch {
      setExportError("No se pudo exportar.");
    } finally {
      setExporting(false);
    }
  }

  if (phase === "loading") {
    return <p className="p-10 text-sm opacity-60">Cargando examen…</p>;
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-md p-10">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  const active = files.find((f) => f.path === activePath) ?? null;

  return (
    <div
      className="flex h-screen flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <form onSubmit={doExport} className="card w-full max-w-xs rounded-lg p-5">
            <input
              type="password"
              autoFocus
              value={exportCode}
              onChange={(e) => setExportCode(e.target.value)}
              placeholder="Código"
              className="field w-full rounded-md px-3 py-2 text-sm outline-none"
            />
            {exportError && <p className="mt-2 text-sm text-red-400">{exportError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowExport(false);
                  setExportCode("");
                  setExportError(null);
                }}
                className="rounded-md border bd px-3 py-1.5 text-sm hoverable"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={exporting}
                className="btn-primary rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              >
                {exporting ? "…" : "Aceptar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {phase === "recovery" && recovery && (
        <RecoveryDialog
          localSavedAt={recovery.localSavedAt}
          remoteCommitAt={remote?.lastCommitAt ?? null}
          onRecover={onRecover}
          onUseRemote={onUseRemote}
        />
      )}

      <header className="flex items-center justify-between border-b bd px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">{remote?.examName}</h1>
          <p className="text-sm opacity-70">
            Último commit: {formatStampShort(lastCommitAt)} · Guardado:{" "}
            {formatStampShort(lastLocalSaveAt)} · Auto-commit cada{" "}
            {remote?.autoCommitIntervalMinutes} min
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {commitMsg && <span className="text-sm opacity-70">{commitMsg}</span>}
          <button
            onClick={() => setShowFiles((v) => !v)}
            className="rounded-md border bd px-3 py-1.5 text-sm transition hoverable"
          >
            {showFiles ? "Ocultar archivos" : "Ver archivos"}
          </button>
          {remote?.statementImageUrl && (
            <button
              onClick={() => setShowStatement((v) => !v)}
              className="rounded-md border bd px-3 py-1.5 text-sm transition hoverable"
            >
              {showStatement ? "Ocultar enunciado" : "Ver enunciado"}
            </button>
          )}
          <ThemeToggle />
          {submitted ? (
            <span className="rounded-md border border-emerald-400/40 px-3 py-1.5 text-sm text-emerald-300">
              Entregado
            </span>
          ) : closed ? (
            <span className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-semibold text-red-300">
              Examen cerrado
            </span>
          ) : (
            <>
              <button
                onClick={() => void runCommit("manual", "/api/commit")}
                disabled={committing}
                className="rounded-md border bd px-3 py-1.5 text-sm transition hoverable disabled:opacity-40"
              >
                {committing ? "Guardando…" : "Guardar / Commit & Push"}
              </button>
              <button
                onClick={() => {
                  if (confirm("¿Entregar el examen? No vas a poder seguir editando."))
                    void runCommit("final", "/api/submit");
                }}
                disabled={committing}
                className="rounded-md btn-primary px-3 py-1.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
              >
                Entregar
              </button>
            </>
          )}
          <button
            onClick={() => {
              setExportError(null);
              setExportCode("");
              setShowExport(true);
            }}
            aria-label="opciones"
            className="rounded-md px-2 py-1.5 text-sm opacity-30 transition hover:opacity-70"
          >
            ⋯
          </button>
        </div>
      </header>

      {closed && !submitted && (
        <div className="bg-red-500/15 px-6 py-3 text-center text-base font-medium text-red-300">
          El examen fue cerrado por el docente. Ya no podés editar ni entregar. Tu entrega
          es tu último commit en GitHub.
        </div>
      )}

      <div ref={mainRef} className="flex min-h-0 flex-1">
        {showFiles && (
        <aside className="w-[220px] shrink-0 overflow-auto border-r bd p-3">
          <p className="mb-2 text-sm uppercase opacity-50">Archivos</p>
          <ul className="flex flex-col gap-1">
            {files.map((f) => (
              <li key={f.path}>
                <button
                  onClick={() => setActivePath(f.path)}
                  className={`w-full truncate rounded px-2 py-1 text-left text-sm ${
                    f.path === activePath ? "surface-2" : "hoverable"
                  }`}
                  title={f.path}
                >
                  {f.path}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        )}

        <section ref={sectionRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            {active ? (
              <WollokEditor
                path={active.path}
                value={active.content}
                editable={!submitted && !closed}
                onChange={(v) => onEditorChange(active.path, v)}
                onActivity={onActivity}
              />
            ) : (
              <p className="p-4 text-sm opacity-60">Seleccioná un archivo.</p>
            )}
          </div>
          <div
            onPointerDown={onResizeStart}
            title="Arrastrá para redimensionar"
            className="surface-2 h-1.5 shrink-0 cursor-row-resize hover:opacity-80"
          />
          <div style={{ height: consoleHeight }} className="shrink-0">
            <WollokConsole getFiles={() => filesRef.current} />
          </div>
        </section>

        {showStatement && remote?.statementImageUrl && (
          <>
            <div
              onPointerDown={onStatementResizeStart}
              title="Arrastrá para ensanchar el enunciado"
              className="surface-2 w-1.5 shrink-0 cursor-col-resize hover:opacity-80"
            />
            <StatementPanel
              imageUrl={remote.statementImageUrl}
              width={statementWidth}
              onClose={() => setShowStatement(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}
