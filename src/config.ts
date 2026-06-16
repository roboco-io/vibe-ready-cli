import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { CategoryTier } from "./types.js";
import { CATEGORY_WEIGHTS } from "./types.js";
import type { AgentId } from "./agents.js";
import { normalizeAgent, SUPPORTED_AGENTS } from "./agents.js";

export interface CategoryConfig {
  name: string;
  tier: CategoryTier;
  weight: number;
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

export function getEffectiveWeights(config: VibeReadyConfig | null): Record<string, { tier: CategoryTier; weight: number }> {
  if (!config) return CATEGORY_WEIGHTS;

  const weights: Record<string, { tier: CategoryTier; weight: number }> = {};
  for (const cat of config.categories) {
    weights[cat.name] = { tier: cat.tier, weight: cat.weight };
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
    if (c.tier !== "must" && c.tier !== "nice") throw new Error(`카테고리 tier는 "must" 또는 "nice"여야 합니다: ${c.name}`);
    if (typeof c.weight !== "number" || c.weight <= 0) throw new Error(`카테고리 weight는 양수여야 합니다: ${c.name}`);

    categories.push({
      name: c.name,
      tier: c.tier as CategoryTier,
      weight: c.weight,
      description: typeof c.description === "string" ? c.description : undefined,
      checkpoints: Array.isArray(c.checkpoints) ? c.checkpoints.map(String) : undefined,
    });
  }

  // 가중치 합계 정규화
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    const scale = 1.0 / totalWeight;
    for (const c of categories) {
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
