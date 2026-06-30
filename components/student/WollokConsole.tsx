"use client";

import { useRef, useState } from "react";
import {
  runTests,
  WollokRepl,
  type RunTestsResult,
  type WollokFile,
} from "@/lib/wollok/runner";
import { WollokReplInput } from "./WollokReplInput";

type Tab = "tests" | "repl";

interface ReplLine {
  input: string;
  output: string;
  errored: boolean;
}

/**
 * Panel inferior: correr tests y consola/REPL. Ejecuta en el cliente con
 * wollok-ts (sin parte gráfica). Lee los archivos actuales vía `getFiles`.
 */
export function WollokConsole({ getFiles }: { getFiles: () => WollokFile[] }) {
  const [tab, setTab] = useState<Tab>("tests");

  // Tests
  const [running, setRunning] = useState(false);
  const [testResult, setTestResult] = useState<RunTestsResult | null>(null);

  // REPL
  const replRef = useRef<WollokRepl | null>(null);
  const [replReady, setReplReady] = useState(false);
  const [replBusy, setReplBusy] = useState(false);
  const [lines, setLines] = useState<ReplLine[]>([]); // más nuevo primero

  async function onRunTests() {
    setRunning(true);
    try {
      setTestResult(await runTests(getFiles()));
    } catch (e) {
      setTestResult({
        total: 0,
        passed: 0,
        failed: 0,
        results: [],
        buildError: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRunning(false);
    }
  }

  async function ensureRepl(rebuild = false) {
    setReplBusy(true);
    try {
      if (!replRef.current) {
        replRef.current = await WollokRepl.create(getFiles());
      } else if (rebuild) {
        await replRef.current.rebuild(getFiles());
      }
      setReplReady(true);
    } finally {
      setReplBusy(false);
    }
  }

  async function onSubmitLine(line: string) {
    if (replBusy) return;
    if (!replRef.current) await ensureRepl();
    const { output, errored } = replRef.current!.evaluate(line);
    setLines((prev) => [{ input: line, output, errored }, ...prev]); // nuevo arriba
  }

  return (
    <div className="flex h-full flex-col border-t bd bg-black/5 dark:bg-black/30">
      <div className="flex items-center gap-1 border-b bd px-2 py-1">
        <button
          onClick={() => setTab("tests")}
          className={`rounded px-3 py-1 text-sm ${tab === "tests" ? "surface-2" : "opacity-60 hover:opacity-100"}`}
        >
          Tests
        </button>
        <button
          onClick={() => setTab("repl")}
          className={`rounded px-3 py-1 text-sm ${tab === "repl" ? "surface-2" : "opacity-60 hover:opacity-100"}`}
        >
          Consola
        </button>
      </div>

      {tab === "tests" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-3 px-3 py-2">
            <button
              onClick={onRunTests}
              disabled={running}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {running ? "Corriendo…" : "Correr tests"}
            </button>
            {testResult && !testResult.buildError && (
              <span className="text-sm opacity-70">
                {testResult.passed}/{testResult.total} pasaron
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-3 pb-3 font-mono text-sm">
            {testResult?.buildError && (
              <pre className="whitespace-pre-wrap text-red-700 dark:text-red-300">
                {testResult.buildError}
              </pre>
            )}
            {testResult?.results.map((r) => (
              <div
                key={r.fqn}
                className={
                  r.passed
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-red-700 dark:text-red-300"
                }
              >
                {r.passed ? "✓" : "✗"} {r.name}
                {r.error && <span className="opacity-80"> — {r.error}</span>}
              </div>
            ))}
            {testResult && testResult.total === 0 && !testResult.buildError && (
              <span className="text-sm opacity-60">No se encontraron tests (.wtest).</span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Input arriba (Monaco de una línea: autocompletado + historial con ↑/↓) */}
          <div className="flex items-center gap-2 border-b bd px-3 py-2">
            <span className="font-mono text-sm opacity-50">&gt;</span>
            <WollokReplInput onSubmit={onSubmitLine} disabled={replBusy} />
            <button
              type="button"
              onClick={() => ensureRepl(true)}
              disabled={replBusy}
              className="shrink-0 rounded-md border bd px-3 py-1 text-sm transition hoverable disabled:opacity-50"
              title="Recarga el código actual en la consola"
            >
              {replBusy ? "…" : replReady ? "Reiniciar" : "Iniciar"}
            </button>
          </div>
          {/* Resultados debajo (más nuevo arriba) */}
          <div className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-sm">
            {lines.length === 0 && (
              <span className="opacity-50">
                Escribí una expresión y Enter. Podés crear objetos, mandarles mensajes y
                modificar atributos.
              </span>
            )}
            {lines.map((l, i) => (
              <div key={lines.length - i} className="mb-2">
                <div className="opacity-80">
                  <span
                    className={
                      l.errored
                        ? "text-red-600 dark:text-red-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {l.errored ? "✗" : "✓"}
                  </span>{" "}
                  &gt; {l.input}
                </div>
                {l.output && (
                  <div
                    className={
                      l.errored
                        ? "text-red-700 dark:text-red-300"
                        : "text-emerald-700 dark:text-emerald-200"
                    }
                  >
                    {l.output}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
