import {
  type AnalysisResult,
  type CategoryResult,
  type CategoryTier,
  type Grade,
  type LLMAnalysisOutput,
  CATEGORY_WEIGHTS,
  gradeFromScore,
} from "./types.js";

export function computeResult(
  llmOutput: LLMAnalysisOutput,
  customWeights?: Record<string, { tier: CategoryTier; weight: number; bonusCap?: number }>,
): AnalysisResult {
  const weights = customWeights ?? CATEGORY_WEIGHTS;
  const categories: CategoryResult[] = llmOutput.categories.map((cat) => ({
    name: cat.name,
    // 설정 파일의 tier를 우선 적용(optional 등은 설정에서만 정의됨). 없으면 LLM 출력 tier.
    tier: weights[cat.name]?.tier ?? cat.tier,
    score: Math.round(Math.max(0, Math.min(100, cat.score))),
    grade: gradeFromScore(cat.score),
    recommendations: cat.recommendations.map((r) => ({
      severity: r.severity as "critical" | "warning" | "info",
      message: r.message,
      action: r.action,
    })),
    rawFindings: cat.rawFindings,
  }));

  const weightedAverage = computeWeightedAverage(categories, weights);
  const bonus = computeOptionalBonus(categories, weights);
  const totalScore = Math.round(Math.max(0, Math.min(100, weightedAverage + bonus)) * 100) / 100;
  let totalGrade = gradeFromScore(totalScore);

  const { penaltyApplied, penaltyReason } = checkPenalty(categories);
  if (penaltyApplied && gradeRank(totalGrade) > gradeRank("C")) {
    totalGrade = "C";
  }

  return {
    categories,
    totalScore,
    totalGrade,
    summary: llmOutput.summary,
    penaltyApplied,
    penaltyReason,
  };
}

function computeWeightedAverage(
  categories: CategoryResult[],
  weights: Record<string, { tier: CategoryTier; weight: number; bonusCap?: number }>,
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const cat of categories) {
    // optional 카테고리는 가중평균에 포함하지 않는다(등급에 영향 없음).
    if (cat.tier === "optional") continue;
    const config = weights[cat.name];
    const weight = config?.weight ?? (cat.tier === "must" ? 0.20 : 0.10);
    weightedSum += cat.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight * 100) / 100;
}

/** optional 카테고리는 점수 비례로 가산점(최대 bonusCap)을 총점에 더한다. */
function computeOptionalBonus(
  categories: CategoryResult[],
  weights: Record<string, { tier: CategoryTier; weight: number; bonusCap?: number }>,
): number {
  let bonus = 0;
  for (const cat of categories) {
    if (cat.tier !== "optional") continue;
    const cap = weights[cat.name]?.bonusCap ?? 0;
    bonus += (cat.score / 100) * cap;
  }
  return bonus;
}

function checkPenalty(categories: CategoryResult[]): {
  penaltyApplied: boolean;
  penaltyReason?: string;
} {
  const failedMust = categories.filter(
    (c) => c.tier === "must" && c.grade === "F"
  );

  if (failedMust.length > 0) {
    const names = failedMust.map((c) => c.name).join(", ");
    return {
      penaltyApplied: true,
      penaltyReason: `필수 카테고리 F 등급: ${names} → 전체 등급 최대 C로 제한`,
    };
  }

  return { penaltyApplied: false };
}

function gradeRank(grade: Grade): number {
  const ranks: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  return ranks[grade];
}
