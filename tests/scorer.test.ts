import { describe, it, expect } from "vitest";
import { computeResult } from "../src/scorer.js";
import { gradeFromScore, CATEGORY_WEIGHTS } from "../src/types.js";
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
    "하네스 엔지니어링": "nice",
    "이슈 트래킹 연동": "nice",
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
        "하네스 엔지니어링": 80,
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
        "리포지토리 구조": 0,   // nice, 0.10
        "문서화 수준": 0,       // nice, 0.10
        "하네스 엔지니어링": 0,  // nice, 0.10
        "이슈 트래킹 연동": 0,  // nice, 0.10
      }),
    );

    // must: 100*0.20*3 = 60, nice: 0*0.10*4 = 0, total weight 1.0, score = 60
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
        "하네스 엔지니어링": 95,
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
        "하네스 엔지니어링": 30,
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
        "하네스 엔지니어링": 10,
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
    expect(grades["하네스 엔지니어링"]).toBe("F");
  });

  it("clamps scores to 0-100 range", () => {
    const result = computeResult(
      makeLLMOutput({
        "테스트 커버리지": 150,
        "CI/CD": -10,
        "훅 기반 검증": 80,
        "리포지토리 구조": 80,
        "문서화 수준": 80,
        "하네스 엔지니어링": 80,
      }),
    );

    const scores = Object.fromEntries(
      result.categories.map((c) => [c.name, c.score]),
    );
    expect(scores["테스트 커버리지"]).toBe(100);
    expect(scores["CI/CD"]).toBe(0);
  });

  it("optional 카테고리는 가중평균(분모)에 들어가지 않고 가산점으로만 더해진다", () => {
    const llm: LLMAnalysisOutput = {
      categories: [
        { name: "테스트 커버리지", tier: "must", score: 80, recommendations: [], rawFindings: [] },
        { name: "CI/CD", tier: "must", score: 80, recommendations: [], rawFindings: [] },
        { name: "보안 설정", tier: "optional", score: 100, recommendations: [], rawFindings: [] },
      ],
      summary: "",
    };
    const weights = {
      "테스트 커버리지": { tier: "must" as const, weight: 0.5 },
      "CI/CD": { tier: "must" as const, weight: 0.5 },
      "보안 설정": { tier: "optional" as const, weight: 0, bonusCap: 5 },
    };
    const result = computeResult(llm, weights);
    // 가중평균 = 80, 가산점 = 100/100 * 5 = 5 → 총점 85
    expect(result.totalScore).toBeCloseTo(85, 0);
  });

  it("optional 가산점이 등급 경계를 넘으면 종합 등급을 올린다 (등급을 낮추지는 않음)", () => {
    // 가중평균 88(B) + 가산점 5 = 93 → A
    const result = computeResult(
      {
        categories: [
          { name: "테스트 커버리지", tier: "must", score: 88, recommendations: [], rawFindings: [] },
          { name: "CI/CD", tier: "must", score: 88, recommendations: [], rawFindings: [] },
          { name: "보안 설정", tier: "optional", score: 100, recommendations: [], rawFindings: [] },
        ],
        summary: "",
      },
      {
        "테스트 커버리지": { tier: "must" as const, weight: 0.5 },
        "CI/CD": { tier: "must" as const, weight: 0.5 },
        "보안 설정": { tier: "optional" as const, weight: 0, bonusCap: 5 },
      },
    );
    expect(result.totalScore).toBeCloseTo(93, 0);
    expect(result.totalGrade).toBe("A");
  });

  it("optional 카테고리가 0점이면 등급/총점에 영향이 없다", () => {
    const base = {
      "테스트 커버리지": { tier: "must" as const, weight: 0.5 },
      "CI/CD": { tier: "must" as const, weight: 0.5 },
    };
    const withoutOpt = computeResult(
      {
        categories: [
          { name: "테스트 커버리지", tier: "must", score: 70, recommendations: [], rawFindings: [] },
          { name: "CI/CD", tier: "must", score: 70, recommendations: [], rawFindings: [] },
        ],
        summary: "",
      },
      base,
    );
    const withOpt = computeResult(
      {
        categories: [
          { name: "테스트 커버리지", tier: "must", score: 70, recommendations: [], rawFindings: [] },
          { name: "CI/CD", tier: "must", score: 70, recommendations: [], rawFindings: [] },
          { name: "보안 설정", tier: "optional", score: 0, recommendations: [], rawFindings: [] },
        ],
        summary: "",
      },
      { ...base, "보안 설정": { tier: "optional" as const, weight: 0, bonusCap: 10 } },
    );
    expect(withOpt.totalScore).toBe(withoutOpt.totalScore);
    expect(withOpt.totalGrade).toBe(withoutOpt.totalGrade);
  });

  it("optional 가산점이 더해져도 총점은 100을 넘지 않는다", () => {
    const result = computeResult(
      {
        categories: [
          { name: "테스트 커버리지", tier: "must", score: 100, recommendations: [], rawFindings: [] },
          { name: "보안 설정", tier: "optional", score: 100, recommendations: [], rawFindings: [] },
        ],
        summary: "",
      },
      {
        "테스트 커버리지": { tier: "must" as const, weight: 1.0 },
        "보안 설정": { tier: "optional" as const, weight: 0, bonusCap: 20 },
      },
    );
    expect(result.totalScore).toBe(100);
  });

  it("optional 카테고리는 F여도 페널티(등급 C 제한) 대상이 아니다", () => {
    const result = computeResult(
      {
        categories: [
          { name: "테스트 커버리지", tier: "must", score: 100, recommendations: [], rawFindings: [] },
          { name: "CI/CD", tier: "must", score: 100, recommendations: [], rawFindings: [] },
          { name: "보안 설정", tier: "optional", score: 0, recommendations: [], rawFindings: [] },
        ],
        summary: "",
      },
      {
        "테스트 커버리지": { tier: "must" as const, weight: 0.5 },
        "CI/CD": { tier: "must" as const, weight: 0.5 },
        "보안 설정": { tier: "optional" as const, weight: 0, bonusCap: 5 },
      },
    );
    expect(result.penaltyApplied).toBe(false);
    expect(result.totalGrade).toBe("A");
  });

  it("penalty caps grade at C even if weighted average is A", () => {
    const result = computeResult(
      makeLLMOutput({
        "테스트 커버리지": 40,  // F - penalty trigger
        "CI/CD": 100,
        "훅 기반 검증": 100,
        "리포지토리 구조": 100,
        "문서화 수준": 100,
        "하네스 엔지니어링": 100,
      }),
    );

    expect(result.penaltyApplied).toBe(true);
    expect(result.totalGrade).toBe("C");
  });
});

describe("CATEGORY_WEIGHTS", () => {
  it("가중치 합계는 1.0이다", () => {
    const total = Object.values(CATEGORY_WEIGHTS).reduce((sum, w) => sum + w.weight, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it("이슈 트래킹 연동 카테고리가 nice 0.10으로 존재한다", () => {
    expect(CATEGORY_WEIGHTS["이슈 트래킹 연동"]).toEqual({ tier: "nice", weight: 0.10 });
  });

  it("must 카테고리는 3개이고 각 0.20이다", () => {
    const musts = Object.values(CATEGORY_WEIGHTS).filter((w) => w.tier === "must");
    expect(musts).toHaveLength(3);
    for (const m of musts) expect(m.weight).toBe(0.20);
  });

  it("nice 카테고리는 4개이고 각 0.10이다", () => {
    const nices = Object.values(CATEGORY_WEIGHTS).filter((w) => w.tier === "nice");
    expect(nices).toHaveLength(4);
    for (const n of nices) expect(n.weight).toBe(0.10);
  });
});
