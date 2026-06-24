import { describe, expect, it } from "vitest";
import {
  autoSaveCommitMessage,
  filterCommittableFiles,
  finalSubmitCommitMessage,
  isCommittablePath,
} from "@/lib/services/commit";

describe("isCommittablePath", () => {
  it("acepta .wlk, .wtest y la bitácora de actividad", () => {
    expect(isCommittablePath("src/main.wlk")).toBe(true);
    expect(isCommittablePath("test/mainTest.wtest")).toBe(true);
    expect(isCommittablePath(".exam/activity.ndjson")).toBe(true);
  });

  it("rechaza README, enunciado y otros archivos", () => {
    expect(isCommittablePath("README.md")).toBe(false);
    expect(isCommittablePath("statement/statement.png")).toBe(false);
    expect(isCommittablePath("package.json")).toBe(false);
  });
});

describe("filterCommittableFiles", () => {
  it("deja solo los archivos permitidos", () => {
    const files = [
      { path: "src/main.wlk", content: "a" },
      { path: "README.md", content: "b" },
      { path: ".exam/activity.ndjson", content: "c" },
      { path: "src/.config", content: "d" },
    ];
    expect(filterCommittableFiles(files).map((f) => f.path)).toEqual([
      "src/main.wlk",
      ".exam/activity.ndjson",
    ]);
  });
});

describe("mensajes de commit", () => {
  const d = new Date(2026, 5, 23, 9, 5); // 2026-06-23 09:05 (local)
  it("formatea auto-save", () => {
    expect(autoSaveCommitMessage(d)).toBe("Auto-save examen 2026-06-23 09:05");
  });
  it("formatea entrega final", () => {
    expect(finalSubmitCommitMessage(d)).toBe("Entrega final examen 2026-06-23 09:05");
  });
});
