import { describe, it, expect } from "vitest";
import { computeResult } from "../src/scorer.js";
import { gradeFromScore } from "../src/types.js";
import type { LLMAnalysisOutput } from "../src/types.js";

describe("gradeFromScore", () => {
  it("returns A for 90+", () => {
    expect(gradeFromScore(90)).toBe("A");
    expect(gradeFromScore(100)).toBe("A");
  });

  it("returns B for 80-89", () => {
    expect(gradeFromScore(80)).toBe("B");
    expect(gradeFromScore(89)).toBe("B");
  });

  it("returns C for 70-79", () => {
    expect(gradeFromScore(70)).toBe("C");
    expect(gradeFromScore(79)).toBe("C");
  });

  it("returns D for 50-69", () => {
    expect(gradeFromScore(50)).toBe("D");
    expect(gradeFromScore(69)).toBe("D");
  });

  it("returns F for <50", () => {
    expect(gradeFromScore(49)).toBe("F");
    expect(gradeFromScore(0)).toBe("F");
  });
});

function makeLLMOutput(scores: Record<string, number>): LLMAnalysisOutput {
  const tiers: Record<string, "must" | "nice"> = {
    "테스트 커버리지": "must",
    "CI/CD": "must",
    "훅 기반 검증": "must",
    "리포지토리 구조": "nice",
    "문서화 수준": "nice",
    "바이브 코딩 설정": "nice",
  };

  return {
    categories: Object.entries(scores).map(([name, score]) => ({
      name,
      tier: tiers[name] ?? "nice",
      score,
      recommendations: [],
      rawFindings: [],
    })),
    summary: "테스트 요약",
  };
}

describe("computeResult", () => {
  it("computes weighted average correctly", () => {
    const result = computeResult(
      makeLLMOutput({
        "테스트 커버리지": 80,
        "CI/CD": 80,
        "훅 기반 검증": 80,
        "리포지토리 구조": 80,
        "문서화 수준": 80,
        "바이브 코딩 설정": 80,
      }),
    );

    expect(result.totalScore).toBeCloseTo(80, 0);
    expect(result.totalGrade).toBe("B");
    expect(result.penaltyApplied).toBe(false);
  });

  it("applies weighted average with different scores", () => {
    const result = computeResult(
      makeLLMOutput({
        "테스트 커버리지": 100, // must, 0.20
        "CI/CD": 100,           // must, 0.20
        "훅 기반 검증": 100,    // must, 0.20
        "리포지토리 구조": 0,   // nice, 0.133
        "문서화 수준": 0,       // nice, 0.133
        "바이브 코딩 설정": 0,  // nice, 0.134
      }),
    );

    // must: 100*0.20*3 = 60, nice: 0, total weight ~1.0, score ~60
    expect(result.totalScore).toBeCloseTo(60, 0);
    expect(result.totalGrade).toBe("D");
  });

  it("applies penalty when must-have category has F grade", () => {
    const result = computeResult(
      makeLLMOutput({
        "테스트 커버리지": 30,  // F!
        "CI/CD": 95,
        "훅 기반 검증": 95,
        "리포지토리 구조": 95,
        "문서화 수준": 95,
        "바이브 코딩 설정": 95,
      }),
    );

    expect(result.penaltyApplied).toBe(true);
    expect(result.penaltyReason).toContain("테스트 커버리지");
    // Without penalty, weighted avg would be high (A or B)
    // But penalty caps at C
    expect(result.totalGrade).toBe("C");
  });

  it("does not apply penalty when must-have categories pass", () => {
    const result = computeResult(
      makeLLMOutput({
        "테스트 커버리지": 60,  // D, not F
        "CI/CD": 60,
        "훅 기반 검증": 60,
        "리포지토리 구조": 30,  // F but nice-to-have
        "문서화 수준": 30,
        "바이브 코딩 설정": 30,
      }),
    );

    expect(result.penaltyApplied).toBe(false);
  });

  it("assigns correct grades to each category", () => {
    const result = computeResult(
      makeLLMOutput({
        "테스트 커버리지": 95,
        "CI/CD": 85,
        "훅 기반 검증": 75,
        "리포지토리 구조": 55,
        "문서화 수준": 40,
        "바이브 코딩 설정": 10,
      }),
    );

    const grades = Object.fromEntries(
      result.categories.map((c) => [c.name, c.grade]),
    );
    expect(grades["테스트 커버리지"]).toBe("A");
    expect(grades["CI/CD"]).toBe("B");
    expect(grades["훅 기반 검증"]).toBe("C");
    expect(grades["리포지토리 구조"]).toBe("D");
    expect(grades["문서화 수준"]).toBe("F");
    expect(grades["바이브 코딩 설정"]).toBe("F");
  });

  it("clamps scores to 0-100 range", () => {
    const result = computeResult(
      makeLLMOutput({
        "테스트 커버리지": 150,
        "CI/CD": -10,
        "훅 기반 검증": 80,
        "리포지토리 구조": 80,
        "문서화 수준": 80,
        "바이브 코딩 설정": 80,
      }),
    );

    const scores = Object.fromEntries(
      result.categories.map((c) => [c.name, c.score]),
    );
    expect(scores["테스트 커버리지"]).toBe(100);
    expect(scores["CI/CD"]).toBe(0);
  });

  it("penalty caps grade at C even if weighted average is A", () => {
    const result = computeResult(
      makeLLMOutput({
        "테스트 커버리지": 40,  // F - penalty trigger
        "CI/CD": 100,
        "훅 기반 검증": 100,
        "리포지토리 구조": 100,
        "문서화 수준": 100,
        "바이브 코딩 설정": 100,
      }),
    );

    expect(result.penaltyApplied).toBe(true);
    expect(result.totalGrade).toBe("C");
  });
});
