import { describe, it, expect } from "vitest";
import { buildAnalysisPrompt, ALL_CATEGORIES } from "../src/prompts/analyze.js";
import { CATEGORY_WEIGHTS } from "../src/types.js";
import type { GitLogContext } from "../src/git-log.js";

describe("buildAnalysisPrompt", () => {
  const prompt = buildAnalysisPrompt();

  describe("훅 기반 검증 — AI agent hooks", () => {
    it("should include AI agent hooks in check items", () => {
      expect(prompt).toContain(".claude/settings.json");
      expect(prompt).toContain("PreCommit");
    });

    it("should include AI agent hooks in scoring criteria", () => {
      // AI 에이전트 훅을 전통 훅과 동등하게 채점 기준에 반영
      expect(prompt).toContain("전통 훅과 AI 에이전트 훅을 동등 취급");
      expect(prompt).toContain("AI 에이전트 PreCommit/PrePush 중 무엇이든");
    });

    it("husky 등 전통 git hook 부재가 감점 사유가 아님을 명시한다", () => {
      expect(prompt).toContain("부재 자체는 감점 사유가");
      expect(prompt).toContain("만점이 가능하다");
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

  describe("git log context", () => {
    const sampleContext: GitLogContext = {
      totalCommits: 100,
      issueRefRate: 45,
      refBreakdown: { github: 30, jira: 15, keywords: 10 },
      mergeCommitCount: 12,
      prWorkflowDetected: true,
      sampleSubjects: ["feat: add login (#12)", "PROJ-3 fix crash"],
    };

    it("gitLogContext가 있으면 통계와 샘플을 프롬프트에 포함한다", () => {
      const prompt = buildAnalysisPrompt(undefined, undefined, sampleContext);
      expect(prompt).toContain("Git Log Context");
      expect(prompt).toContain("45%");
      expect(prompt).toContain("feat: add login (#12)");
    });

    it("gitLogContext가 null이면 폴백 안내를 포함한다", () => {
      const prompt = buildAnalysisPrompt(undefined, undefined, null);
      expect(prompt).toContain("커밋 히스토리를 확인할 수 없");
    });

    it("이슈 트래킹 연동 카테고리가 ALL_CATEGORIES와 프롬프트에 포함된다", () => {
      expect(ALL_CATEGORIES).toContain("이슈 트래킹 연동");
      const prompt = buildAnalysisPrompt();
      expect(prompt).toContain("이슈 트래킹 연동");
      expect(prompt).toContain("7 categories");
    });

    it("CATEGORY_WEIGHTS의 모든 카테고리가 프롬프트에 등장한다 (드리프트 방지)", () => {
      const prompt = buildAnalysisPrompt();
      for (const name of Object.keys(CATEGORY_WEIGHTS)) {
        expect(prompt).toContain(name);
      }
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

    it("이슈 트래킹 연동 should have 6 scoring tiers", () => {
      const section = prompt.split("**이슈 트래킹 연동**")[1].split("## Output Requirements")[0];
      for (const tier of scoreTiers) {
        expect(section).toContain(tier);
      }
    });
  });
});
