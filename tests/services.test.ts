import { describe, expect, it } from "vitest";
import { MockGitHubService } from "@/lib/services/github-integration.service";
import {
  makeEventIdFactory,
  parseActivityNdjson,
  serializeActivityNdjson,
} from "@/lib/services/activity-logging";

describe("MockGitHubService", () => {
  it("genera repo desde template, commitea, archiva y lista", async () => {
    const gh = new MockGitHubService();
    const repo = await gh.generateFromTemplate({
      org: "ExamUnahurP",
      templateRepo: "tpl",
      repoName: "parcial2-ana",
    });
    expect(repo.url).toContain("ExamUnahurP/parcial2-ana");
    expect(repo.archived).toBe(false);

    // el template trae archivos
    const files = await gh.readWorkspace({ org: "ExamUnahurP", repoName: "parcial2-ana" });
    expect(files.some((f) => f.path.endsWith(".wlk"))).toBe(true);

    const commit = await gh.commitFiles({
      org: "ExamUnahurP",
      repoName: "parcial2-ana",
      files: [{ path: "pepita.wlk", content: "object pepita {}" }],
      message: "Auto-save examen 2026-06-24 10:00 · ip 1.2.3.4",
    });
    expect(commit.sha).toMatch(/^[0-9a-f]+$/);
    expect(commit.message).toContain("ip 1.2.3.4");

    const last = await gh.getLastCommit({ org: "ExamUnahurP", repoName: "parcial2-ana" });
    expect(last?.sha).toBe(commit.sha);

    const list = await gh.listRepos({ org: "ExamUnahurP", prefix: "parcial2-" });
    expect(list.map((r) => r.name)).toContain("parcial2-ana");

    await gh.archiveRepo({ org: "ExamUnahurP", repoName: "parcial2-ana" });
    const after = await gh.getRepo({ org: "ExamUnahurP", repoName: "parcial2-ana" });
    expect(after?.archived).toBe(true);
    // archivado => no se puede commitear
    await expect(
      gh.commitFiles({
        org: "ExamUnahurP",
        repoName: "parcial2-ana",
        files: [],
        message: "x",
      }),
    ).rejects.toThrow();
  });
});

describe("activity ndjson", () => {
  it("genera event_id únicos y round-trip de NDJSON", () => {
    const nextId = makeEventIdFactory("exam1", "user");
    const events = [
      { event_id: nextId(), type: "edit" as const, ts: "2026-06-24T10:00:00", added: 12, removed: 0 },
      { event_id: nextId(), type: "paste_attempt" as const, ts: "2026-06-24T10:00:01" },
    ];
    expect(events[0].event_id).toBe("exam1-user-000001");
    expect(events[1].event_id).toBe("exam1-user-000002");
    const ndjson = serializeActivityNdjson(events);
    expect(parseActivityNdjson(ndjson)).toEqual(events);
  });
});
