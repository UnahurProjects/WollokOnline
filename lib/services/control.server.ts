import "server-only";
import { sanitizeExamName } from "./exam.service";
import { getOrg } from "./exam.server";
import { getGitHubService } from "./github-integration.service";

/**
 * Estado de control de cada examen, en un repo central `_control` de la org
 * (un archivo JSON por examen). Una sola escritura por acción (no por alumno).
 *
 * - intervalMinutes: intervalo de auto-commit del examen.
 * - closingAt: hora de cierre de la cuenta regresiva (ISO) o null. Es BLANDA:
 *   solo muestra el contador + dispara commit final; NO bloquea.
 * - closed: cierre DURO. Si es true, el server rechaza commits.
 */
export const CONTROL_REPO = "_control";

export interface ExamControl {
  intervalMinutes: number;
  closingAt: string | null;
  closed: boolean;
}

const DEFAULT: ExamControl = { intervalMinutes: 10, closingAt: null, closed: false };

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
      closingAt: typeof p.closingAt === "string" ? p.closingAt : null,
      closed: !!p.closed,
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
