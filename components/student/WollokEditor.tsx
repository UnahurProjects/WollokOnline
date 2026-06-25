"use client";

import dynamic from "next/dynamic";
import type { editor } from "monaco-editor";
import type { ActivityEventType } from "@/lib/types/db";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { registerWollokLanguage } from "@/lib/wollok/monaco-language";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.Editor),
  {
    ssr: false,
    loading: () => <div className="p-4 text-sm opacity-60">Cargando editor…</div>,
  },
);

/**
 * Editor Wollok basado en Monaco.
 *
 * El alumno SOLO puede escribir y borrar. Se bloquea toda copia/pegado de forma
 * agresiva (es disuasivo, el frontend no es seguridad real):
 *  - keybindings Ctrl/Cmd+C/X/V sobrescritos a no-op (Monaco maneja el portapapeles
 *    por atajos, no solo por eventos DOM);
 *  - eventos copy/cut/paste bloqueados en captura sobre el contenedor y el textarea
 *    interno (cubre el pegar con botón central del mouse en Linux);
 *  - menú contextual y drag&drop bloqueados.
 * Cada intento se registra.
 */
export function WollokEditor({
  path,
  value,
  editable,
  onChange,
  onActivity,
}: {
  path: string;
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  onActivity: (type: ActivityEventType) => void;
}) {
  const { theme } = useTheme();

  function handleMount(ed: editor.IStandaloneCodeEditor, monaco: any) {
    ed.updateOptions({ contextmenu: false });

    // 1) Sobrescribir los atajos de portapapeles a no-op (+ registrar intento).
    const C = monaco.KeyMod.CtrlCmd;
    ed.addCommand(C | monaco.KeyCode.KeyC, () => onActivity("copy_attempt"));
    ed.addCommand(C | monaco.KeyCode.KeyX, () => onActivity("cut_attempt"));
    ed.addCommand(C | monaco.KeyCode.KeyV, () => onActivity("paste_attempt"));
    // Insert (pegar) y Shift+Insert también
    ed.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Insert, () =>
      onActivity("paste_attempt"),
    );

    // 2) Bloquear eventos del DOM en captura, sobre el contenedor y el textarea.
    const dom = ed.getDomNode();
    if (!dom) return;
    const textarea = dom.querySelector("textarea");
    const targets: Element[] = textarea ? [dom, textarea] : [dom];

    const block = (type?: ActivityEventType) => (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (type) onActivity(type);
    };

    // Pegado primario de Linux/X11: clic con el botón del medio (button === 1).
    const blockMiddle = (e: Event) => {
      if ((e as MouseEvent).button === 1) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onActivity("paste_attempt");
      }
    };

    for (const t of targets) {
      t.addEventListener("copy", block("copy_attempt"), true);
      t.addEventListener("cut", block("cut_attempt"), true);
      t.addEventListener("paste", block("paste_attempt"), true);
      t.addEventListener("contextmenu", block(), true);
      t.addEventListener("dragstart", block(), true);
      t.addEventListener("drop", block(), true);
      t.addEventListener("dragover", block(), true);
      t.addEventListener("auxclick", blockMiddle, true);
      t.addEventListener("mousedown", blockMiddle, true);
      t.addEventListener("pointerdown", blockMiddle, true);
    }

    ed.onDidFocusEditorText(() => onActivity("focus_returned"));
    ed.onDidBlurEditorText(() => onActivity("focus_lost"));
  }

  return (
    <MonacoEditor
      path={path}
      language="wollok"
      theme={theme === "dark" ? "vs-dark" : "vs"}
      value={value}
      beforeMount={(monaco) => registerWollokLanguage(monaco)}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      options={{
        readOnly: !editable,
        minimap: { enabled: false },
        fontSize: 14,
        contextmenu: false,
        scrollBeyondLastLine: false,
        wordWrap: "on",
      }}
    />
  );
}
