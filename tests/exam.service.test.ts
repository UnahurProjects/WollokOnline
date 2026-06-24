import { describe, expect, it } from "vitest";
import {
  buildRepoName,
  canTransitionExam,
  parseUsernames,
  sanitizeEditablePaths,
  sanitizeExamName,
} from "@/lib/services/exam.service";

describe("sanitizeExamName", () => {
  it("genera un slug seguro", () => {
    expect(sanitizeExamName("Parcial 2 — Comisión 1")).toBe("parcial-2-comisi-n-1");
    expect(sanitizeExamName("  parcial2-com1  ")).toBe("parcial2-com1");
  });
});

describe("parseUsernames", () => {
  it("parsea lista separada por líneas", () => {
    expect(parseUsernames("alumno1\nalumno2\nalumno3")).toEqual([
      "alumno1",
      "alumno2",
      "alumno3",
    ]);
  });

  it("parsea lista separada por comas y espacios", () => {
    expect(parseUsernames("alumno1, alumno2,  alumno3")).toEqual([
      "alumno1",
      "alumno2",
      "alumno3",
    ]);
  });

  it("normaliza a minúsculas, quita @ y deduplica", () => {
    expect(parseUsernames("@Nahuel\nnahuel\nMARIA")).toEqual(["nahuel", "maria"]);
  });

  it("ignora entradas vacías", () => {
    expect(parseUsernames("  \n , \n alumno1 \n")).toEqual(["alumno1"]);
  });
});

describe("canTransitionExam", () => {
  it("permite draft→open y open→closed", () => {
    expect(canTransitionExam("draft", "open")).toBe(true);
    expect(canTransitionExam("open", "closed")).toBe(true);
  });

  it("no permite reabrir ni saltear estados", () => {
    expect(canTransitionExam("closed", "open")).toBe(false);
    expect(canTransitionExam("draft", "closed")).toBe(false);
    expect(canTransitionExam("open", "draft")).toBe(false);
  });
});

describe("buildRepoName", () => {
  it("reemplaza tokens del patrón", () => {
    expect(
      buildRepoName("parcial2-comision1-{username}", { username: "nahuellurbe" }),
    ).toBe("parcial2-comision1-nahuellurbe");
  });

  it("colapsa guiones de tokens vacíos", () => {
    expect(buildRepoName("{exam}-{username}", { username: "ana" })).toBe("ana");
  });
});

describe("sanitizeEditablePaths", () => {
  it("acepta solo .wlk/.wtest y deduplica", () => {
    expect(
      sanitizeEditablePaths("src/main.wlk\nREADME.md, test/x.wtest\nsrc/main.wlk"),
    ).toEqual(["src/main.wlk", "test/x.wtest"]);
  });

  it("descarta todo lo que no sea código/test Wollok", () => {
    expect(sanitizeEditablePaths(["statement/statement.png", "package.json"])).toEqual([]);
  });
});
