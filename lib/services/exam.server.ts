import "server-only";
import { parseUsernames, sanitizeExamName } from "./exam.service";
import { getGitHubService } from "./github-integration.service";
import {
  CONTROL_REPO,
  getExamControl,
  readExamControl,
  setExamControl,
  type ExamControl,
} from "./control.server";

/**
 * Lógica del examen, GitHub-only (sin base de datos).
 * Estado de control (intervalo, cuenta regresiva, cierre) en el repo `_control`.
 */

export function getOrg(): string {
  return process.env.GITHUB_DEFAULT_ORG || "ExamUnahurP";
}

function repoName(examSlug: string, username: string): string {
  return `${examSlug}-${username}`;
}

// Repos creados en paralelo DENTRO de una tanda. La app docente manda las tandas de
// a una (cada tanda es un request corto que entra en el timeout de Vercel) y marca
// el ritmo entre tandas; acá solo acotamos la concurrencia (tope de GitHub: 100).
const CREATE_CONCURRENCY = 8;

/** Corre `fn` sobre `items` con como mucho `concurrency` en vuelo a la vez. */
async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      await fn(items[next++]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
}

export interface StartExamInput {
  examName: string;
  usernames: string;
  autoCommitIntervalMinutes: number;
  /** Duración del examen en minutos (0 = sin límite de tiempo). */
  durationMinutes: number;
  /** Si el examen ya existe y está abierto, confirma agregar usuarios (no pisa el control). */
  confirmAddToExisting?: boolean;
  teacher: string;
}

export interface StartExamResult {
  examName: string;
  org: string;
  /** Usernames a CREAR ahora (examen nuevo = todos; agregar = solo los nuevos). La app los crea en tandas. */
  roster: string[];
  /** "created" = examen nuevo; "appended" = se agregaron usuarios a uno abierto (sin tocar la hora). */
  mode: "created" | "appended";
}

/**
 * El examen ya existe. La app decide: si está ABIERTO, ofrece agregar usuarios
 * (sin tocar la hora de fin); si está CERRADO, pide elegir otro nombre.
 */
export class ExamExistsError extends Error {
  kind: "open" | "closed";
  examName: string;
  newUsernames: string[];
  alreadyIn: string[];
  constructor(kind: "open" | "closed", examName: string, newUsernames: string[], alreadyIn: string[]) {
    super(`El examen "${examName}" ya existe (${kind === "closed" ? "cerrado" : "abierto"}).`);
    this.name = "ExamExistsError";
    this.kind = kind;
    this.examName = examName;
    this.newUsernames = newUsernames;
    this.alreadyIn = alreadyIn;
  }
}

export interface CreateBatchInput {
  examName: string;
  templateRepo: string;
  usernames: string[];
}

export interface CreateBatchResult {
  created: { username: string; repoName: string; repoUrl: string }[];
  /** Alumnos cuyo repo no se pudo crear (crear a mano; salen en rojo en el dashboard). */
  failed: { username: string; repoName: string; error: string }[];
}

/**
 * No se pudo escribir el control central (la "partida de nacimiento" del examen):
 * GitHub no respondió. Trae el archivo exacto para cargarlo a mano en `_control`.
 */
export class ExamControlError extends Error {
  manualControl: { repo: string; path: string; content: string };
  constructor(manualControl: { repo: string; path: string; content: string }) {
    super("No se pudo crear el examen: GitHub no respondió. Cargá el control a mano.");
    this.name = "ExamControlError";
    this.manualControl = manualControl;
  }
}

/**
 * Crea el examen o AGREGA usuarios a uno existente. Escribe SOLO el control central
 * `_control/{slug}.json` (intervalo, hora de fin, roster). Los repos de alumnos NO se
 * crean acá: la app docente los crea por tandas con `createExamBatch`.
 *
 * Si el examen YA existe:
 *  - cerrado → ExamExistsError("closed"): no se puede agregar, elegir otro nombre.
 *  - abierto y sin confirmar → ExamExistsError("open"): la app pide confirmación.
 *  - abierto y confirmado → agrega los usuarios nuevos al roster SIN tocar la hora de
 *    fin ni el intervalo (no se pisa el control); devuelve solo los nuevos a crear.
 */
export async function startExam(input: StartExamInput): Promise<StartExamResult> {
  const slug = sanitizeExamName(input.examName);
  if (!slug) throw new Error("Nombre de examen inválido.");
  const requested = parseUsernames(input.usernames);
  if (requested.length === 0) throw new Error("No se reconoció ningún usuario.");

  const org = getOrg();
  const existing = await readExamControl(slug);

  // ── El examen YA existe ────────────────────────────────────────────────────
  if (existing) {
    if (existing.closed) {
      throw new ExamExistsError("closed", slug, [], []);
    }
    const alreadyIn = requested.filter((u) => existing.roster.includes(u));
    const newUsernames = requested.filter((u) => !existing.roster.includes(u));
    if (!input.confirmAddToExisting) {
      throw new ExamExistsError("open", slug, newUsernames, alreadyIn);
    }
    // Confirmado: agregar al roster SIN tocar endsAt / intervalo / closed.
    if (newUsernames.length > 0) {
      await setExamControl(slug, { roster: [...existing.roster, ...newUsernames] });
    }
    return { examName: slug, org, roster: newUsernames, mode: "appended" };
  }

  // ── Examen nuevo ───────────────────────────────────────────────────────────
  const endsAt =
    input.durationMinutes > 0
      ? new Date(Date.now() + input.durationMinutes * 60_000).toISOString()
      : null;
  const control: ExamControl = {
    intervalMinutes: input.autoCommitIntervalMinutes,
    endsAt,
    closed: false,
    roster: requested,
    startedAt: new Date().toISOString(),
  };
  try {
    await setExamControl(slug, control);
  } catch {
    throw new ExamControlError({
      repo: CONTROL_REPO,
      path: `${slug}.json`,
      content: JSON.stringify(control, null, 2) + "\n",
    });
  }

  return { examName: slug, org, roster: requested, mode: "created" };
}

/**
 * Crea los repos de UNA tanda de alumnos desde el template, en paralelo acotado
 * (CREATE_CONCURRENCY). La app docente la llama repetidamente (una tanda a la vez,
 * marcando el ritmo entre tandas), de modo que cada request sea corto y entre en
 * Vercel. Tolera fallos por alumno (→ `failed` → rojo en el dashboard).
 */
export async function createExamBatch(input: CreateBatchInput): Promise<CreateBatchResult> {
  const slug = sanitizeExamName(input.examName);
  if (!slug) throw new Error("Nombre de examen inválido.");
  const org = getOrg();
  const github = await getGitHubService();

  const created: CreateBatchResult["created"] = [];
  const failed: CreateBatchResult["failed"] = [];

  await runPool(input.usernames, CREATE_CONCURRENCY, async (username) => {
    const name = repoName(slug, username);
    try {
      const repo = await github.generateFromTemplate({
        org,
        templateRepo: input.templateRepo,
        repoName: name,
        description: `Examen: ${slug}`,
      });
      created.push({ username, repoName: repo.name, repoUrl: repo.url });
    } catch (e) {
      failed.push({
        username,
        repoName: name,
        error: e instanceof Error ? e.message : "Error al crear el repo",
      });
    }
  });

  return { created, failed };
}

/** Extiende el examen sumando minutos a la hora de fin (o desde ahora si no había). */
export async function extendExam(
  examName: string,
  minutes: number,
): Promise<{ endsAt: string }> {
  const control = await getExamControl(examName);
  const base = control.endsAt ? new Date(control.endsAt).getTime() : Date.now();
  const endsAt = new Date(base + minutes * 60_000).toISOString();
  await setExamControl(examName, { endsAt });
  return { endsAt };
}

/** Cierre DURO/manual: nadie puede commitear más, sin esperar a la hora de fin. */
export async function closeExam(examName: string): Promise<void> {
  await setExamControl(examName, { closed: true });
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export type ExamActivity = "sin_actividad" | "trabajando" | "entregado";

function ipFromMessage(message: string | undefined): string | null {
  if (!message) return null;
  const m = message.match(/·\s*ip\s+(\S+)/i);
  return m ? m[1] : null;
}

function activityFromMessage(message: string | undefined): ExamActivity {
  if (!message) return "sin_actividad";
  if (/entrega final/i.test(message)) return "entregado";
  if (/auto-save/i.test(message)) return "trabajando";
  return "sin_actividad";
}

export interface DashboardRow {
  username: string;
  repoName: string;
  repoUrl: string | null;
  lastCommitAt: string | null;
  lastCommitIp: string | null;
  activity: ExamActivity;
  /** true si hace más que el intervalo que no commitea (y el examen no está cerrado). */
  late: boolean;
  /** true si está en el roster pero su repo todavía no existe (crear a mano). */
  missing: boolean;
}

export interface DashboardData {
  rows: DashboardRow[];
  control: ExamControl;
}

export async function getDashboard(examName: string): Promise<DashboardData> {
  const slug = sanitizeExamName(examName);
  const org = getOrg();
  const github = await getGitHubService();

  const control = await getExamControl(slug);
  const repos = await github.listRepos({ org, prefix: `${slug}-` });
  const lasts = await github.getLastCommits({ org, repoNames: repos.map((r) => r.name) });

  const now = Date.now();
  const lateMs = control.intervalMinutes * 60_000;
  const startedMs = control.startedAt ? new Date(control.startedAt).getTime() : null;

  const rows: DashboardRow[] = repos.map((r) => {
    const last = lasts[r.name] ?? null;
    const lastAt = last?.committedAt ?? null;
    // "Atrasado" (rojo) = examen abierto Y:
    //  - commiteó pero hace más que el intervalo, o
    //  - nunca commiteó y ya pasó un intervalo desde que arrancó (gracia inicial).
    const late =
      !control.closed &&
      (lastAt
        ? now - new Date(lastAt).getTime() > lateMs
        : startedMs !== null && now - startedMs > lateMs);
    return {
      username: r.name.slice(`${slug}-`.length),
      repoName: r.name,
      repoUrl: r.url,
      lastCommitAt: lastAt,
      lastCommitIp: ipFromMessage(last?.message),
      activity: activityFromMessage(last?.message),
      late,
      missing: false,
    };
  });

  // Inscriptos del roster que todavía no tienen repo → en rojo, para crear a mano.
  const existing = new Set(repos.map((r) => r.name.slice(`${slug}-`.length)));
  for (const username of control.roster) {
    if (existing.has(username)) continue;
    rows.push({
      username,
      repoName: `${slug}-${username}`,
      repoUrl: null,
      lastCommitAt: null,
      lastCommitIp: null,
      activity: "sin_actividad",
      late: false,
      missing: true,
    });
  }

  // Faltantes (sin repo) primero; luego atrasados; luego el resto por usuario.
  rows.sort((a, b) => {
    if (a.missing !== b.missing) return a.missing ? -1 : 1;
    if (a.late !== b.late) return a.late ? -1 : 1;
    if (a.late && b.late) {
      const ta = a.lastCommitAt ? new Date(a.lastCommitAt).getTime() : 0;
      const tb = b.lastCommitAt ? new Date(b.lastCommitAt).getTime() : 0;
      return ta - tb;
    }
    return a.username.localeCompare(b.username);
  });

  return { rows, control };
}
