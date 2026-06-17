import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { CategoryTier } from "./types.js";
import { CATEGORY_WEIGHTS } from "./types.js";
import type { AgentId } from "./agents.js";
import { normalizeAgent, SUPPORTED_AGENTS } from "./agents.js";

export interface CategoryConfig {
  name: string;
  tier: CategoryTier;
  /** 가중평균에 반영되는 비중(must/nice). optional 카테고리에서는 무시되며 0으로 취급. */
  weight: number;
  /** optional 카테고리 전용: 점수 비례로 총점에 더해지는 최대 가산점. */
  bonusCap?: number;
  description?: string;
  checkpoints?: string[];
}

export interface VibeReadyConfig {
  categories: CategoryConfig[];
  penaltyRule?: {
    enabled: boolean;
    maxGrade: string;
    condition: string;
  };
  /** 하네스 엔지니어링 평가를 한정할 코딩 에이전트. 미지정 시 자동 감지. */
  agent?: AgentId;
}

const CONFIG_FILENAMES = [".vibeready.json", ".vibeready.config.json", "vibeready.config.json"];

export function loadConfig(repoPath: string): VibeReadyConfig | null {
  for (const filename of CONFIG_FILENAMES) {
    const filepath = join(repoPath, filename);
    if (existsSync(filepath)) {
      try {
        const raw = JSON.parse(readFileSync(filepath, "utf-8"));
        return validateConfig(raw);
      } catch (e) {
        throw new Error(`설정 파일 파싱 실패 (${filename}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return null;
}

export function getEffectiveCategories(config: VibeReadyConfig | null): CategoryConfig[] {
  if (config) return config.categories;

  return Object.entries(CATEGORY_WEIGHTS).map(([name, { tier, weight }]) => ({
    name,
    tier,
    weight,
  }));
}

export function getEffectiveWeights(config: VibeReadyConfig | null): Record<string, { tier: CategoryTier; weight: number; bonusCap?: number }> {
  if (!config) return CATEGORY_WEIGHTS;

  const weights: Record<string, { tier: CategoryTier; weight: number; bonusCap?: number }> = {};
  for (const cat of config.categories) {
    weights[cat.name] = { tier: cat.tier, weight: cat.weight, bonusCap: cat.bonusCap };
  }
  return weights;
}

function validateConfig(raw: unknown): VibeReadyConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("설정 파일은 JSON 객체여야 합니다");
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.categories) || obj.categories.length === 0) {
    throw new Error("categories 배열이 필요합니다 (최소 1개)");
  }

  const categories: CategoryConfig[] = [];
  for (const cat of obj.categories) {
    if (typeof cat !== "object" || !cat) throw new Error("각 카테고리는 객체여야 합니다");
    const c = cat as Record<string, unknown>;

    if (typeof c.name !== "string") throw new Error("카테고리 name이 필요합니다");
    if (c.tier !== "must" && c.tier !== "nice" && c.tier !== "optional") {
      throw new Error(`카테고리 tier는 "must", "nice", "optional" 중 하나여야 합니다: ${c.name}`);
    }

    const isOptional = c.tier === "optional";
    let bonusCap: number | undefined;
    if (isOptional) {
      // optional: weight 대신 bonusCap(가산점 상한)을 사용. weight는 무시(0).
      if (typeof c.bonusCap !== "number" || c.bonusCap <= 0) {
        throw new Error(`optional 카테고리는 양수 bonusCap이 필요합니다: ${c.name}`);
      }
      bonusCap = c.bonusCap;
    } else if (typeof c.weight !== "number" || c.weight <= 0) {
      throw new Error(`카테고리 weight는 양수여야 합니다: ${c.name}`);
    }

    categories.push({
      name: c.name,
      tier: c.tier as CategoryTier,
      weight: isOptional ? 0 : (c.weight as number),
      bonusCap,
      description: typeof c.description === "string" ? c.description : undefined,
      checkpoints: Array.isArray(c.checkpoints) ? c.checkpoints.map(String) : undefined,
    });
  }

  // 가중치 합계 정규화 (optional은 가중평균에 들어가지 않으므로 제외)
  const scorable = categories.filter((c) => c.tier !== "optional");
  if (scorable.length === 0) {
    throw new Error("must/nice 카테고리가 최소 1개 필요합니다 (optional만으로는 구성할 수 없음)");
  }
  const totalWeight = scorable.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    const scale = 1.0 / totalWeight;
    for (const c of scorable) {
      c.weight = Math.round(c.weight * scale * 1000) / 1000;
    }
  }

  return { categories, penaltyRule: validatePenaltyRule(obj.penaltyRule), agent: validateAgent(obj.agent) };
}

function validateAgent(raw: unknown): AgentId | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") throw new Error(`agent는 문자열이어야 합니다 (지원: ${SUPPORTED_AGENTS.join(", ")})`);
  const normalized = normalizeAgent(raw);
  if (!normalized) throw new Error(`알 수 없는 agent: "${raw}" (지원: ${SUPPORTED_AGENTS.join(", ")})`);
  return normalized;
}

/** CLI 옵션이 config보다 우선. 둘 다 없으면 undefined(자동 감지). */
export function getEffectiveAgent(config: VibeReadyConfig | null, cliAgent?: AgentId | null): AgentId | undefined {
  return cliAgent ?? config?.agent ?? undefined;
}

function validatePenaltyRule(raw: unknown): VibeReadyConfig["penaltyRule"] {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  return {
    enabled: r.enabled !== false,
    maxGrade: typeof r.maxGrade === "string" ? r.maxGrade : "C",
    condition: typeof r.condition === "string" ? r.condition : "any must-have category F",
  };
}
