import "server-only";
import { sanitizeExamName } from "./exam.service";
import { getOrg } from "./exam.server";
import { getGitHubService } from "./github-integration.service";

/**
 * Estado de control de cada examen, en un repo central `_control` de la org
 * (un archivo JSON por examen). Una sola escritura por acción (no por alumno).
 *
 * - intervalMinutes: intervalo de auto-commit del examen.
 * - endsAt: hora de fin del examen (ISO) o null. Se fija al iniciar (inicio +
 *   duración) y se puede extender. El cliente calcula el contador desde acá; el
 *   server rechaza commits pasada esa hora.
 * - closed: cierre DURO/manual. Si es true, el server rechaza commits ya mismo.
 * - roster: usernames inscriptos (verdad de quién debería rendir). El dashboard
 *   marca en rojo los del roster que todavía no tienen repo (crear a mano).
 */
export const CONTROL_REPO = "_control";

export interface ExamControl {
  intervalMinutes: number;
  endsAt: string | null;
  closed: boolean;
  roster: string[];
}

const DEFAULT: ExamControl = { intervalMinutes: 10, endsAt: null, closed: false, roster: [] };

function controlPath(slug: string): string {
  return `${slug}.json`;
}

export async function getExamControl(examName: string): Promise<ExamControl> {
  const slug = sanitizeExamName(examName);
  const github = await getGitHubService();
  let txt: string | null = null;
  try {
    txt = await github.getFileText({ org: getOrg(), repoName: CONTROL_REPO }, controlPath(slug));
  } catch {
    txt = null;
  }
  if (!txt) return { ...DEFAULT };
  try {
    const p = JSON.parse(txt);
    return {
      intervalMinutes:
        typeof p.intervalMinutes === "number" ? p.intervalMinutes : DEFAULT.intervalMinutes,
      endsAt: typeof p.endsAt === "string" ? p.endsAt : null,
      closed: !!p.closed,
      roster: Array.isArray(p.roster)
        ? p.roster.filter((u: unknown): u is string => typeof u === "string")
        : [],
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function setExamControl(
  examName: string,
  patch: Partial<ExamControl>,
): Promise<ExamControl> {
  const slug = sanitizeExamName(examName);
  const org = getOrg();
  const github = await getGitHubService();
  await github.ensureRepo({
    org,
    name: CONTROL_REPO,
    description: "Control de exámenes de Wollok Exam Online (no editar a mano).",
  });
  const current = await getExamControl(slug);
  const next: ExamControl = { ...current, ...patch };
  await github.commitFiles({
    org,
    repoName: CONTROL_REPO,
    files: [{ path: controlPath(slug), content: JSON.stringify(next, null, 2) + "\n" }],
    message: `control ${slug}`,
  });
  return next;
}
