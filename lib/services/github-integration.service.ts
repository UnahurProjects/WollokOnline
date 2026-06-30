import type { CommitResult, RepoInfo, WorkspaceFile } from "./types";

/**
 * GitHubService — única superficie para operar repos en GitHub.
 *
 * GitHub es la ÚNICA fuente de verdad del examen (no hay base de datos):
 * - estado abierto  = el repo existe y NO está archivado;
 * - estado cerrado  = el repo está archivado (solo lectura).
 *
 * En Fase 1 hay una implementación MOCK en memoria (sin red) detrás del flag
 * GITHUB_INTEGRATION_MODE=mock. La implementación real con GitHub App (octokit)
 * es WOLL-027 y requiere credenciales.
 *
 * Todas estas operaciones corren SOLO en el servidor (Route Handlers). El token
 * de GitHub nunca llega al browser; el alumno no es colaborador.
 */
export interface RepoRef {
  org: string;
  repoName: string;
}

export interface GenerateOptions {
  org: string;
  templateRepo: string;
  repoName: string;
  description?: string;
}

export interface CommitOptions {
  org: string;
  repoName: string;
  files: WorkspaceFile[];
  message: string;
}

export interface GitHubService {
  /** Crea un repo privado a partir del template (generate-from-template). Idempotente. */
  generateFromTemplate(opts: GenerateOptions): Promise<RepoInfo>;
  getRepo(ref: RepoRef): Promise<RepoInfo | null>;
  readWorkspace(ref: RepoRef): Promise<WorkspaceFile[]>;
  commitFiles(opts: CommitOptions): Promise<CommitResult>;
  getLastCommit(ref: RepoRef): Promise<CommitResult | null>;
  /** Cierra el examen: archiva el repo (solo lectura). */
  archiveRepo(ref: RepoRef): Promise<void>;
  /** Lista repos de la org cuyo nombre empieza con el prefijo (ej. "parcial2-"). */
  listRepos(opts: { org: string; prefix: string }): Promise<RepoInfo[]>;
  /** Enunciado del repo (imagen o markdown), o null si no hay. */
  findStatement(ref: RepoRef): Promise<StatementRef | null>;
  /** Bytes de la imagen de enunciado (o null si no hay). */
  getStatementImage(
    ref: RepoRef,
  ): Promise<{ data: Uint8Array; contentType: string } | null>;
  /** Lee el texto de un archivo (o null si no existe). Para el repo de control. */
  getFileText(ref: RepoRef, path: string): Promise<string | null>;
  /** Crea el repo si no existe (con commit inicial). Para el repo de control. */
  ensureRepo(opts: { org: string; name: string; description?: string }): Promise<void>;
  /** Último commit de varios repos en pocas llamadas (GraphQL en la impl real). */
  getLastCommits(opts: {
    org: string;
    repoNames: string[];
  }): Promise<Record<string, CommitResult | null>>;
}

/** Extensiones de imagen soportadas para el enunciado → content-type. */
export const IMAGE_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** Elige la imagen de enunciado entre los paths (prioriza statement/enunciado/readme). */
export function pickStatementPath(paths: string[]): string | null {
  const imgs = paths.filter((p) => {
    const ext = p.split(".").pop()?.toLowerCase() ?? "";
    return IMAGE_CONTENT_TYPES[ext];
  });
  if (imgs.length === 0) return null;
  return imgs.find((p) => /statement|enunciado|readme/i.test(p)) ?? imgs[0];
}

/** Tipo de enunciado: imagen (servida como `<img>`) o markdown (texto reflowable). */
export type StatementKind = "image" | "markdown";
export interface StatementRef {
  path: string;
  kind: StatementKind;
}

function isImagePath(p: string): boolean {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  return !!IMAGE_CONTENT_TYPES[ext];
}

/**
 * Elige el enunciado entre los paths del repo. El enunciado se llama `README`
 * (puede haber imagen, `.md`, o ambas). Prioridad: IMAGEN antes que markdown.
 *   1) un README en imagen (`README.png/jpg/…`)  → imagen;
 *   2) si no, un README en markdown (`README.md`) → markdown.
 * Como red de seguridad (exámenes viejos con otro nombre): igual prioriza
 * cualquier imagen y, en última instancia, cualquier `.md`.
 */
export function pickStatement(paths: string[]): StatementRef | null {
  const isMd = (p: string) => /\.md$/i.test(p);
  const isStatementName = (p: string) => /readme|enunciado|statement/i.test(p);

  const imgs = paths.filter(isImagePath);
  const mds = paths.filter(isMd);

  const namedImg = imgs.find(isStatementName);
  if (namedImg) return { path: namedImg, kind: "image" };

  const namedMd = mds.find(isStatementName);
  if (namedMd) return { path: namedMd, kind: "markdown" };

  if (imgs.length) return { path: imgs[0], kind: "image" };
  if (mds.length) return { path: mds[0], kind: "markdown" };
  return null;
}

// ── Mock en memoria ─────────────────────────────────────────────────────────

/** Contenido del template (mock). El template real vive en GitHub (WOLL-027). */
const TEMPLATE_FILES: WorkspaceFile[] = [
  {
    path: "pepita.wlk",
    content:
      "object pepita {\n  var energia = 100\n\n  method energia() = energia\n\n  method comer(gramos) {\n    energia = energia + gramos\n  }\n\n  method volar(minutos) {\n    energia = energia - (minutos * 3)\n  }\n}\n",
  },
  {
    path: "pepitaTest.wtest",
    content:
      'import pepita.*\n\ntest "comer aumenta la energia" {\n  pepita.comer(50)\n  assert.equals(150, pepita.energia())\n}\n\ntest "volar disminuye la energia" {\n  pepita.volar(10)\n  assert.equals(70, pepita.energia())\n}\n',
  },
  {
    path: ".exam/config.json",
    content: JSON.stringify({ autoCommitIntervalMinutes: 5 }, null, 2) + "\n",
  },
];

interface MockRepo {
  name: string;
  org: string;
  archived: boolean;
  files: Map<string, string>;
  lastCommit: CommitResult | null;
}

function fakeSha(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(7, "0").slice(0, 7);
}

/**
 * Mock en memoria (persiste por proceso). Suficiente para desarrollo y demo.
 * En producción lo reemplaza la GitHub App real (WOLL-027).
 */
export class MockGitHubService implements GitHubService {
  private repos = new Map<string, MockRepo>();

  private key(org: string, repoName: string) {
    return `${org}/${repoName}`;
  }

  private toInfo(r: MockRepo): RepoInfo {
    return {
      name: r.name,
      url: `https://github.com/${r.org}/${r.name}`,
      archived: r.archived,
    };
  }

  async generateFromTemplate(opts: GenerateOptions): Promise<RepoInfo> {
    const key = this.key(opts.org, opts.repoName);
    const existing = this.repos.get(key);
    if (existing) return this.toInfo(existing);

    const repo: MockRepo = {
      name: opts.repoName,
      org: opts.org,
      archived: false,
      files: new Map(TEMPLATE_FILES.map((f) => [f.path, f.content])),
      lastCommit: null,
    };
    this.repos.set(key, repo);
    return this.toInfo(repo);
  }

  async getRepo(ref: RepoRef): Promise<RepoInfo | null> {
    const r = this.repos.get(this.key(ref.org, ref.repoName));
    return r ? this.toInfo(r) : null;
  }

  async readWorkspace(ref: RepoRef): Promise<WorkspaceFile[]> {
    const r = this.repos.get(this.key(ref.org, ref.repoName));
    if (!r) return [];
    return [...r.files.entries()].map(([path, content]) => ({ path, content }));
  }

  async commitFiles(opts: CommitOptions): Promise<CommitResult> {
    const r = this.repos.get(this.key(opts.org, opts.repoName));
    if (!r) throw new Error(`Repo no encontrado: ${opts.repoName}`);
    if (r.archived) throw new Error("El repo está archivado (examen cerrado).");
    for (const f of opts.files) r.files.set(f.path, f.content);

    const now = new Date();
    const sha = fakeSha(this.key(opts.org, opts.repoName) + opts.message + now.toISOString());
    r.lastCommit = {
      sha,
      committedAt: now.toISOString(),
      htmlUrl: `https://github.com/${opts.org}/${opts.repoName}/commit/${sha}`,
      message: opts.message,
    };
    return r.lastCommit;
  }

  async getLastCommit(ref: RepoRef): Promise<CommitResult | null> {
    return this.repos.get(this.key(ref.org, ref.repoName))?.lastCommit ?? null;
  }

  async archiveRepo(ref: RepoRef): Promise<void> {
    const r = this.repos.get(this.key(ref.org, ref.repoName));
    if (r) r.archived = true;
  }

  async listRepos(opts: { org: string; prefix: string }): Promise<RepoInfo[]> {
    return [...this.repos.values()]
      .filter((r) => r.org === opts.org && r.name.startsWith(opts.prefix))
      .map((r) => this.toInfo(r));
  }

  async findStatement(ref: RepoRef): Promise<StatementRef | null> {
    const r = this.repos.get(this.key(ref.org, ref.repoName));
    return r ? pickStatement([...r.files.keys()]) : null;
  }

  async getStatementImage(): Promise<{ data: Uint8Array; contentType: string } | null> {
    // El template mock no trae imagen.
    return null;
  }

  async getFileText(ref: RepoRef, path: string): Promise<string | null> {
    const r = this.repos.get(this.key(ref.org, ref.repoName));
    return r?.files.get(path) ?? null;
  }

  async ensureRepo(opts: { org: string; name: string }): Promise<void> {
    const key = this.key(opts.org, opts.name);
    if (!this.repos.get(key)) {
      this.repos.set(key, {
        name: opts.name,
        org: opts.org,
        archived: false,
        files: new Map(),
        lastCommit: null,
      });
    }
  }

  async getLastCommits(opts: {
    org: string;
    repoNames: string[];
  }): Promise<Record<string, CommitResult | null>> {
    const out: Record<string, CommitResult | null> = {};
    for (const name of opts.repoNames) {
      out[name] = this.repos.get(this.key(opts.org, name))?.lastCommit ?? null;
    }
    return out;
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

let cached: GitHubService | null = null;

export async function getGitHubService(): Promise<GitHubService> {
  if (cached) return cached;

  const mode = process.env.GITHUB_INTEGRATION_MODE ?? "mock";
  if (mode === "app") {
    // Import dinámico para no bundlear octokit cuando se usa el mock.
    const { AppGitHubService } = await import("./github-app.service");
    cached = new AppGitHubService();
  } else {
    cached = new MockGitHubService();
  }
  return cached;
}
