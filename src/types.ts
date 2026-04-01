export type Grade = "A" | "B" | "C" | "D" | "F";

export type CategoryTier = "must" | "nice";

export interface RawFinding {
  item: string;
  found: boolean;
  details: string;
}

export interface Recommendation {
  severity: "critical" | "warning" | "info";
  message: string;
  action: string;
}

export interface CategoryResult {
  name: string;
  tier: CategoryTier;
  score: number;
  grade: Grade;
  recommendations: Recommendation[];
  rawFindings: RawFinding[];
}

export interface AnalysisResult {
  categories: CategoryResult[];
  totalScore: number;
  totalGrade: Grade;
  summary: string;
  penaltyApplied: boolean;
  penaltyReason?: string;
}

export interface LLMCategoryOutput {
  name: string;
  tier: CategoryTier;
  score: number;
  recommendations: { severity: string; message: string; action: string }[];
  rawFindings: { item: string; found: boolean; details: string }[];
}

export interface LLMAnalysisOutput {
  categories: LLMCategoryOutput[];
  summary: string;
}

export function gradeFromScore(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 50) return "D";
  return "F";
}

export const CATEGORY_WEIGHTS: Record<string, { tier: CategoryTier; weight: number }> = {
  "테스트 커버리지": { tier: "must", weight: 0.20 },
  "CI/CD": { tier: "must", weight: 0.20 },
  "훅 기반 검증": { tier: "must", weight: 0.20 },
  "리포지토리 구조": { tier: "nice", weight: 0.133 },
  "문서화 수준": { tier: "nice", weight: 0.133 },
  "하네스 엔지니어링": { tier: "nice", weight: 0.134 },
};

export interface BranchResult {
  branch: string;
  result: AnalysisResult;
}

export const ANALYSIS_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    categories: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          tier: { type: "string" as const, enum: ["must", "nice"] },
          score: { type: "number" as const, minimum: 0, maximum: 100 },
          recommendations: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                severity: { type: "string" as const, enum: ["critical", "warning", "info"] },
                message: { type: "string" as const },
                action: { type: "string" as const },
              },
              required: ["severity", "message", "action"],
            },
          },
          rawFindings: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                item: { type: "string" as const },
                found: { type: "boolean" as const },
                details: { type: "string" as const },
              },
              required: ["item", "found", "details"],
            },
          },
        },
        required: ["name", "tier", "score", "recommendations", "rawFindings"],
      },
    },
    summary: { type: "string" as const },
  },
  required: ["categories", "summary"],
};
