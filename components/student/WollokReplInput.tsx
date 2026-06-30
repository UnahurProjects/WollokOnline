"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type { editor } from "monaco-editor";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { registerWollokLanguage } from "@/lib/wollok/monaco-language";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.Editor),
  { ssr: false, loading: () => <div className="text-sm opacity-40">…</div> },
);

/**
 * Input de la consola/REPL basado en Monaco (una sola línea). Reusa el lenguaje
 * Wollok y el autocompletado por palabras de Monaco mirando TODOS los modelos
 * abiertos (`allDocuments`) → sugiere los métodos/objetos que escribiste en el
 * código, igual que el editor.
 *
 * - Enter / Shift+Enter → enviar la línea (salvo que esté abierto el menú de
 *   sugerencias: ahí Enter ACEPTA la sugerencia, comportamiento normal de Monaco).
 * - ↑/↓ → historial de comandos (salvo con el menú de sugerencias abierto, que
 *   navega la lista).
 * - copia/pegado bloqueados, igual que el editor del examen.
 */
export function WollokReplInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (line: string) => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const edRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // Historial de comandos (viejo → nuevo) + índice de navegación.
  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef<number | null>(null);

  function setText(v: string) {
    const ed = edRef.current;
    if (!ed) return;
    ed.setValue(v);
    ed.setPosition({ lineNumber: 1, column: v.length + 1 });
  }

  function submit() {
    const ed = edRef.current;
    if (!ed) return;
    const line = ed.getValue().trim();
    if (!line) return;
    historyRef.current.push(line);
    histIdxRef.current = null;
    onSubmitRef.current(line);
    ed.setValue("");
  }

  function handleMount(ed: editor.IStandaloneCodeEditor, monaco: any) {
    edRef.current = ed;

    // Enviar (cuando NO está abierto el menú de sugerencias).
    ed.addCommand(monaco.KeyCode.Enter, submit, "!suggestWidgetVisible");
    ed.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, submit, "!suggestWidgetVisible");

    // Historial con ↑/↓ (cuando NO está abierto el menú de sugerencias).
    ed.addCommand(
      monaco.KeyCode.UpArrow,
      () => {
        const h = historyRef.current;
        if (h.length === 0) return;
        const idx = histIdxRef.current === null ? h.length - 1 : Math.max(0, histIdxRef.current - 1);
        histIdxRef.current = idx;
        setText(h[idx]);
      },
      "!suggestWidgetVisible",
    );
    ed.addCommand(
      monaco.KeyCode.DownArrow,
      () => {
        const h = historyRef.current;
        if (histIdxRef.current === null) return;
        const idx = histIdxRef.current + 1;
        if (idx >= h.length) {
          histIdxRef.current = null;
          setText("");
        } else {
          histIdxRef.current = idx;
          setText(h[idx]);
        }
      },
      "!suggestWidgetVisible",
    );

    // Anti-copia/pegado (igual que el editor del examen).
    const C = monaco.KeyMod.CtrlCmd;
    const noop = () => {};
    ed.addCommand(C | monaco.KeyCode.KeyC, noop);
    ed.addCommand(C | monaco.KeyCode.KeyX, noop);
    ed.addCommand(C | monaco.KeyCode.KeyV, noop);
    ed.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Insert, noop);

    const dom = ed.getDomNode();
    if (!dom) return;
    const textarea = dom.querySelector("textarea");
    const targets: Element[] = textarea ? [dom, textarea] : [dom];
    const block = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    for (const t of targets) {
      for (const ev of ["copy", "cut", "paste", "contextmenu", "dragstart", "drop", "dragover"]) {
        t.addEventListener(ev, block, true);
      }
    }
  }

  return (
    <div className="flex-1 overflow-hidden">
      <MonacoEditor
        height="22px"
        language="wollok"
        theme={theme === "dark" ? "wollok-dark" : "wollok-light"}
        defaultValue=""
        beforeMount={(monaco) => registerWollokLanguage(monaco)}
        onMount={handleMount}
        options={{
          readOnly: disabled,
          lineNumbers: "off",
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 0,
          minimap: { enabled: false },
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          renderLineHighlight: "none",
          scrollBeyondLastLine: false,
          scrollBeyondLastColumn: 0,
          scrollbar: { vertical: "hidden", horizontal: "hidden", handleMouseWheel: false },
          wordWrap: "off",
          contextmenu: false,
          fontSize: 14,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          // El menú de sugerencias puede desbordar el contenedor chico sin recortarse.
          fixedOverflowWidgets: true,
          wordBasedSuggestions: "allDocuments",
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
          // Cosas innecesarias en una sola línea.
          parameterHints: { enabled: false },
          hover: { enabled: false },
          links: false,
        }}
      />
    </div>
  );
}
