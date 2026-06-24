import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { App } from "octokit";
import {
  IMAGE_CONTENT_TYPES,
  pickStatementPath,
  type CommitOptions,
  type GenerateOptions,
  type GitHubService,
  type RepoRef,
} from "./github-integration.service";
import type { CommitResult, RepoInfo, WorkspaceFile } from "./types";

/**
 * Implementación real con GitHub App (octokit). Activar con
 * GITHUB_INTEGRATION_MODE=app y las envs GITHUB_APP_ID / INSTALLATION_ID /
 * PRIVATE_KEY. La App necesita permisos Administration (crear/archivar repos)
 * y Contents (leer/escribir).
 */
const WANTED = /\.(wlk|wtest)$/i;
const CONFIG_PATH = ".exam/config.json";

export class AppGitHubService implements GitHubService {
  private octokitPromise: Promise<any> | null = null;

  private resolvePrivateKey(): string {
    // 1) Contenido directo en GITHUB_APP_PRIVATE_KEY (acepta \n escapados).
    const inline = process.env.GITHUB_APP_PRIVATE_KEY;
    if (inline && inline.trim()) return inline.replace(/\\n/g, "\n");
    // 2) Ruta a un archivo .pem en GITHUB_APP_PRIVATE_KEY_PATH (relativa al cwd).
    const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    if (keyPath && keyPath.trim()) {
      return readFileSync(resolve(process.cwd(), keyPath.trim()), "utf8");
    }
    return "";
  }

  private getOctokit(): Promise<any> {
    if (!this.octokitPromise) {
      const appId = process.env.GITHUB_APP_ID;
      const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
      const privateKey = this.resolvePrivateKey();
      if (!appId || !installationId || !privateKey) {
        throw new Error(
          "Faltan credenciales de GitHub App (GITHUB_APP_ID / INSTALLATION_ID / " +
            "GITHUB_APP_PRIVATE_KEY o GITHUB_APP_PRIVATE_KEY_PATH).",
        );
      }
      const app = new App({ appId, privateKey });
      this.octokitPromise = app.getInstallationOctokit(Number(installationId));
    }
    return this.octokitPromise;
  }

  async generateFromTemplate(opts: GenerateOptions): Promise<RepoInfo> {
    const existing = await this.getRepo({ org: opts.org, repoName: opts.repoName });
    if (existing) return existing;

    const octokit = await this.getOctokit();
    const r = await octokit.rest.repos.createUsingTemplate({
      template_owner: opts.org,
      template_repo: opts.templateRepo,
      owner: opts.org,
      name: opts.repoName,
      private: true,
      description: opts.description,
    });
    return { name: r.data.name, url: r.data.html_url, archived: false };
  }

  async getRepo(ref: RepoRef): Promise<RepoInfo | null> {
    const octokit = await this.getOctokit();
    try {
      const r = await octokit.rest.repos.get({ owner: ref.org, repo: ref.repoName });
      return { name: r.data.name, url: r.data.html_url, archived: r.data.archived };
    } catch (e: any) {
      if (e?.status === 404) return null;
      throw e;
    }
  }

  private async treeSha(octokit: any, org: string, repoName: string, branch: string) {
    const ref = await octokit.rest.git.getRef({
      owner: org,
      repo: repoName,
      ref: `heads/${branch}`,
    });
    const commit = await octokit.rest.git.getCommit({
      owner: org,
      repo: repoName,
      commit_sha: ref.data.object.sha,
    });
    return { commitSha: ref.data.object.sha, treeSha: commit.data.tree.sha };
  }

  async readWorkspace(ref: RepoRef): Promise<WorkspaceFile[]> {
    const octokit = await this.getOctokit();
    const repo = await octokit.rest.repos.get({ owner: ref.org, repo: ref.repoName });
    const branch = repo.data.default_branch;
    const { treeSha } = await this.treeSha(octokit, ref.org, ref.repoName, branch);
    const tree = await octokit.rest.git.getTree({
      owner: ref.org,
      repo: ref.repoName,
      tree_sha: treeSha,
      recursive: "true",
    });

    const wanted = (tree.data.tree as any[]).filter(
      (e) => e.type === "blob" && (WANTED.test(e.path) || e.path === CONFIG_PATH),
    );

    const files: WorkspaceFile[] = [];
    for (const e of wanted) {
      const blob = await octokit.rest.git.getBlob({
        owner: ref.org,
        repo: ref.repoName,
        file_sha: e.sha,
      });
      const content = Buffer.from(blob.data.content, blob.data.encoding).toString("utf8");
      files.push({ path: e.path, content });
    }
    return files;
  }

  async commitFiles(opts: CommitOptions): Promise<CommitResult> {
    const octokit = await this.getOctokit();
    const repo = await octokit.rest.repos.get({ owner: opts.org, repo: opts.repoName });
    const branch = repo.data.default_branch;
    const { commitSha, treeSha } = await this.treeSha(
      octokit,
      opts.org,
      opts.repoName,
      branch,
    );

    const newTree = await octokit.rest.git.createTree({
      owner: opts.org,
      repo: opts.repoName,
      base_tree: treeSha,
      tree: opts.files.map((f) => ({
        path: f.path,
        mode: "100644",
        type: "blob",
        content: f.content,
      })) as any,
    });

    const newCommit = await octokit.rest.git.createCommit({
      owner: opts.org,
      repo: opts.repoName,
      message: opts.message,
      tree: newTree.data.sha,
      parents: [commitSha],
    });

    await octokit.rest.git.updateRef({
      owner: opts.org,
      repo: opts.repoName,
      ref: `heads/${branch}`,
      sha: newCommit.data.sha,
    });

    return {
      sha: newCommit.data.sha,
      committedAt: newCommit.data.author?.date ?? new Date().toISOString(),
      htmlUrl: `https://github.com/${opts.org}/${opts.repoName}/commit/${newCommit.data.sha}`,
      message: opts.message,
    };
  }

  async getLastCommit(ref: RepoRef): Promise<CommitResult | null> {
    const octokit = await this.getOctokit();
    try {
      const r = await octokit.rest.repos.listCommits({
        owner: ref.org,
        repo: ref.repoName,
        per_page: 1,
      });
      const c = r.data[0];
      if (!c) return null;
      return {
        sha: c.sha,
        committedAt: c.commit.author?.date ?? new Date().toISOString(),
        htmlUrl: c.html_url,
        message: c.commit.message,
      };
    } catch (e: any) {
      if (e?.status === 404 || e?.status === 409) return null; // repo vacío
      throw e;
    }
  }

  async archiveRepo(ref: RepoRef): Promise<void> {
    const octokit = await this.getOctokit();
    await octokit.rest.repos.update({
      owner: ref.org,
      repo: ref.repoName,
      archived: true,
    });
  }

  async listRepos(opts: { org: string; prefix: string }): Promise<RepoInfo[]> {
    const octokit = await this.getOctokit();
    const repos = await octokit.paginate(octokit.rest.repos.listForOrg, {
      org: opts.org,
      per_page: 100,
      type: "all",
    });
    return (repos as any[])
      .filter((r) => r.name.startsWith(opts.prefix))
      .map((r) => ({ name: r.name, url: r.html_url, archived: r.archived }));
  }

  private async listAllPaths(octokit: any, org: string, repoName: string): Promise<string[]> {
    const repo = await octokit.rest.repos.get({ owner: org, repo: repoName });
    const { treeSha } = await this.treeSha(octokit, org, repoName, repo.data.default_branch);
    const tree = await octokit.rest.git.getTree({
      owner: org,
      repo: repoName,
      tree_sha: treeSha,
      recursive: "true",
    });
    return (tree.data.tree as any[]).filter((e) => e.type === "blob").map((e) => e.path);
  }

  async findStatementPath(ref: RepoRef): Promise<string | null> {
    const octokit = await this.getOctokit();
    return pickStatementPath(await this.listAllPaths(octokit, ref.org, ref.repoName));
  }

  async getStatementImage(
    ref: RepoRef,
  ): Promise<{ data: Uint8Array; contentType: string } | null> {
    const octokit = await this.getOctokit();
    const path = pickStatementPath(await this.listAllPaths(octokit, ref.org, ref.repoName));
    if (!path) return null;

    const res = await octokit.rest.repos.getContent({
      owner: ref.org,
      repo: ref.repoName,
      path,
    });
    const file = res.data as { content?: string; encoding?: string };
    if (!file.content) return null;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return {
      data: Buffer.from(file.content, (file.encoding as BufferEncoding) || "base64"),
      contentType: IMAGE_CONTENT_TYPES[ext] ?? "application/octet-stream",
    };
  }
}
