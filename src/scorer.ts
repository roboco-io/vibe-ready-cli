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
  customWeights?: Record<string, { tier: CategoryTier; weight: number }>,
): AnalysisResult {
  const weights = customWeights ?? CATEGORY_WEIGHTS;
  const categories: CategoryResult[] = llmOutput.categories.map((cat) => ({
    name: cat.name,
    tier: cat.tier,
    score: Math.round(Math.max(0, Math.min(100, cat.score))),
    grade: gradeFromScore(cat.score),
    recommendations: cat.recommendations.map((r) => ({
      severity: r.severity as "critical" | "warning" | "info",
      message: r.message,
      action: r.action,
    })),
    rawFindings: cat.rawFindings,
  }));

  const totalScore = computeWeightedAverage(categories, weights);
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
  weights: Record<string, { tier: CategoryTier; weight: number }>,
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const cat of categories) {
    const config = weights[cat.name];
    const weight = config?.weight ?? (cat.tier === "must" ? 0.20 : 0.10);
    weightedSum += cat.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight * 100) / 100;
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
