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
      expect(prompt).toContain("AI agent PreCommit only");
      expect(prompt).toContain("AI agent validation");
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

  describe("scoring granularity — all categories should have 6 tiers", () => {
    const scoreTiers = ["0 =", "20 =", "40 =", "60 =", "80 =", "100 ="];

    it("테스트 커버리지 should have 6 scoring tiers", () => {
      const section = prompt.split("테스트 커버리지")[1].split("**CI/CD**")[0];
      for (const tier of scoreTiers) {
        expect(section).toContain(tier);
      }
    });

    it("CI/CD should have 6 scoring tiers", () => {
      const section = prompt.split("**CI/CD**")[1].split("훅 기반 검증")[0];
      for (const tier of scoreTiers) {
        expect(section).toContain(tier);
      }
    });

    it("훅 기반 검증 should have 6 scoring tiers", () => {
      const section = prompt.split("훅 기반 검증")[1].split("리포지토리 구조")[0];
      for (const tier of scoreTiers) {
        expect(section).toContain(tier);
      }
    });

    it("리포지토리 구조 should have 6 scoring tiers", () => {
      const section = prompt.split("리포지토리 구조")[1].split("문서화 수준")[0];
      for (const tier of scoreTiers) {
        expect(section).toContain(tier);
      }
    });

    it("문서화 수준 should have 6 scoring tiers", () => {
      const section = prompt.split("문서화 수준")[1].split("하네스 엔지니어링")[0];
      for (const tier of scoreTiers) {
        expect(section).toContain(tier);
      }
    });

    it("하네스 엔지니어링 should have 6 scoring tiers", () => {
      const section = prompt.split("하네스 엔지니어링")[1];
      for (const tier of scoreTiers) {
        expect(section).toContain(tier);
      }
    });
  });
});
