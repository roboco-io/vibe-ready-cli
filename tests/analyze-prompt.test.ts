import { describe, it, expect } from "vitest";
import { buildAnalysisPrompt } from "../src/prompts/analyze.js";

describe("buildAnalysisPrompt", () => {
  const prompt = buildAnalysisPrompt();

  describe("훅 기반 검증 — AI agent hooks", () => {
    it("should include AI agent hooks in check items", () => {
      expect(prompt).toContain(".claude/settings.json");
      expect(prompt).toContain("PreCommit");
    });

    it("should include AI agent hooks in scoring criteria", () => {
      expect(prompt).toContain("AI agent PreCommit hook only");
      expect(prompt).toContain("AI agent hooks");
    });

    it("should still include traditional git hook items", () => {
      expect(prompt).toContain("husky");
      expect(prompt).toContain("lint-staged");
      expect(prompt).toContain("commitlint");
      expect(prompt).toContain("lefthook");
    });
  });

  describe("하네스 엔지니어링 — independent PreCommit reference", () => {
    it("should still reference PreCommit in harness engineering section", () => {
      const harnessSection = prompt.split("하네스 엔지니어링")[1];
      expect(harnessSection).toContain("PreCommit");
    });
  });
});
