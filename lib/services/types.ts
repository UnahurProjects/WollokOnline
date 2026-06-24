/** Tipos compartidos por la capa de servicios (GitHub-only). */

export interface WorkspaceFile {
  /** Path relativo dentro del repo, ej. "pepita.wlk". */
  path: string;
  content: string;
}

export interface RepoInfo {
  name: string;
  url: string;
  archived: boolean;
}

export interface CommitResult {
  sha: string;
  committedAt: string; // ISO-8601
  htmlUrl: string;
  message: string;
}
