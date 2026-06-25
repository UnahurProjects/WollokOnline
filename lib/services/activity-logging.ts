import type { ActivityEventType } from "@/lib/types/db";

/**
 * ActivityLoggingService — en Fase 1 es CLIENT-SIDE.
 *
 * Registra la actividad del alumno (ediciones, intentos de copia/pegado, foco,
 * etc.) en memoria/IndexedDB y la serializa a .exam/activity.ndjson, que viaja
 * dentro de cada commit. NO se envía a ningún servidor: el import y análisis es Fase 2
 * (con unique(enrollment_id, event_id) para idempotencia).
 *
 * Módulo puro (sin dependencias de servidor) para poder usarse en el cliente.
 */
export interface ActivityEventInput {
  type: ActivityEventType;
  ts: string; // ISO-8601
  file?: string;
  added?: number;
  removed?: number;
  metadata?: Record<string, unknown>;
}

export interface ActivityEventRecord extends ActivityEventInput {
  event_id: string;
}

/**
 * Genera event_id únicos y deterministas por sesión de examen:
 *   `${examId}-${username}-${seq6}`  (ej. "exam1-user-000001")
 * El contador (seq) se persiste en IndexedDB para sobrevivir recargas.
 */
export function makeEventIdFactory(
  examId: string,
  username: string,
  startSeq = 0,
): () => string {
  let seq = startSeq;
  const base = `${examId}-${username}`;
  return () => {
    seq += 1;
    return `${base}-${String(seq).padStart(6, "0")}`;
  };
}

/** Serializa una lista de eventos a formato NDJSON (una línea JSON por evento). */
export function serializeActivityNdjson(events: ActivityEventRecord[]): string {
  return events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");
}

/** Parsea NDJSON a eventos (tolerante a líneas vacías). Útil para reanudar. */
export function parseActivityNdjson(text: string): ActivityEventRecord[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ActivityEventRecord);
}
