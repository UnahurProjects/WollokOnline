"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Panel lateral del enunciado. Ancho controlado por el contenedor (redimensible
 * desde ExamWorkspace). Dos modos:
 *   - imagen: zoom por ancho (la imagen no reflows; se ensancha el panel y se hace scroll);
 *   - markdown: texto que se amolda al ancho del panel; el zoom cambia el tamaño de fuente.
 * En ambos modos: anti-copia (sin seleccionar, copiar, cortar, pegar ni menú contextual).
 */
export function StatementPanel({
  imageUrl,
  markdown,
  width,
  onClose,
}: {
  imageUrl?: string | null;
  markdown?: string | null;
  width: number;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);

  const btn = "rounded border bd px-2 py-0.5 text-sm transition hoverable";
  const block = (e: React.ClipboardEvent | React.MouseEvent) => e.preventDefault();

  return (
    <aside style={{ width }} className="flex shrink-0 flex-col">
      <div className="flex items-center justify-between border-b bd px-3 py-2">
        <span className="text-sm font-medium">Enunciado</span>
        <div className="flex items-center gap-1">
          <button className={btn} onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}>
            −
          </button>
          <span className="w-12 text-center text-sm opacity-60">
            {Math.round(zoom * 100)}%
          </span>
          <button className={btn} onClick={() => setZoom((z) => Math.min(4, z + 0.2))}>
            +
          </button>
          <button className={btn} onClick={onClose} title="Ocultar enunciado">
            ✕
          </button>
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto bg-black/5 p-2 dark:bg-black/30"
        onContextMenu={block}
        onCopy={block}
        onCut={block}
        onPaste={block}
        onDragStart={block}
      >
        {markdown != null ? (
          <div
            className="md-statement no-select select-none"
            style={{ fontSize: `${Math.round(15 * zoom)}px` }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Enunciado del examen"
            draggable={false}
            onContextMenu={block}
            onLoad={(e) => setNaturalWidth(e.currentTarget.naturalWidth)}
            className="no-select max-w-none select-none"
            style={{ width: `${Math.round((naturalWidth ?? 700) * zoom)}px` }}
          />
        ) : null}
      </div>
    </aside>
  );
}
