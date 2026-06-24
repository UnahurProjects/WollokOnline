import { openDB, type IDBPDatabase } from "idb";
import type {
  ActivityEventInput,
  ActivityEventRecord,
} from "@/lib/services/activity-logging";
import { serializeActivityNdjson } from "@/lib/services/activity-logging";

/**
 * Almacenamiento local INTERNO (IndexedDB).
 *
 * Es invisible para el alumno y solo sirve como mecanismo de recuperación ante
 * fallos de la app + bitácora de actividad. Se considera NO confiable y
 * controlado por el usuario: nunca es fuente de verdad ni evidencia. La entrega
 * oficial es siempre el último commit en GitHub. No exponer UI de
 * "archivo local / descargar / editar".
 */
export interface LocalFile {
  path: string;
  content: string;
}

export interface LocalWorkspace {
  examId: string;
  files: LocalFile[];
  /** Última vez que se guardó localmente (ISO). */
  lastLocalSaveAt: string;
  /** Último commit conocido al momento de guardar (ISO), si lo hubo. */
  lastCommitAt: string | null;
}

interface ActivityState {
  examId: string;
  seq: number;
  events: ActivityEventRecord[];
}

const DB_NAME = "wollok-exam";
const WORKSPACES = "workspaces";
const ACTIVITY = "activity";

let dbp: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(WORKSPACES)) {
          d.createObjectStore(WORKSPACES, { keyPath: "examId" });
        }
        if (!d.objectStoreNames.contains(ACTIVITY)) {
          d.createObjectStore(ACTIVITY, { keyPath: "examId" });
        }
      },
    });
  }
  return dbp;
}

// ── Workspace ───────────────────────────────────────────────────────────────

export async function getLocalWorkspace(
  examId: string,
): Promise<LocalWorkspace | undefined> {
  return (await db()).get(WORKSPACES, examId) as Promise<LocalWorkspace | undefined>;
}

export async function setLocalWorkspace(ws: LocalWorkspace): Promise<void> {
  await (await db()).put(WORKSPACES, ws);
}

export async function clearLocalWorkspace(examId: string): Promise<void> {
  const d = await db();
  await d.delete(WORKSPACES, examId);
  await d.delete(ACTIVITY, examId);
}

/**
 * Decide si la copia local es más reciente que lo último commiteado en GitHub.
 * Sin commit remoto, cualquier copia local cuenta como más reciente.
 */
export function isLocalNewer(
  localSavedAt: string,
  remoteCommitAt: string | null,
): boolean {
  if (!remoteCommitAt) return true;
  return new Date(localSavedAt).getTime() > new Date(remoteCommitAt).getTime();
}

// ── Actividad (.exam/activity.ndjson) ────────────────────────────────────────

/**
 * Agrega eventos de actividad a la bitácora local, asignando event_id únicos
 * (`${examId}-${username}-${seq}`). Viajan en cada commit (WOLL-021).
 */
export async function appendActivityEvents(
  examId: string,
  username: string,
  events: ActivityEventInput[],
): Promise<void> {
  if (events.length === 0) return;
  const d = await db();
  const cur =
    ((await d.get(ACTIVITY, examId)) as ActivityState | undefined) ??
    ({ examId, seq: 0, events: [] } satisfies ActivityState);

  for (const e of events) {
    cur.seq += 1;
    cur.events.push({
      ...e,
      event_id: `${examId}-${username}-${String(cur.seq).padStart(6, "0")}`,
    });
  }
  await d.put(ACTIVITY, cur);
}

/** Serializa la bitácora local a NDJSON (para incluirla en el commit). */
export async function getActivityNdjson(examId: string): Promise<string> {
  const cur = (await (await db()).get(ACTIVITY, examId)) as
    | ActivityState
    | undefined;
  return serializeActivityNdjson(cur?.events ?? []);
}
