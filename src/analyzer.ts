import { buildAnalysisPrompt } from "./prompts/analyze.js";
import { ANALYSIS_JSON_SCHEMA, type LLMAnalysisOutput } from "./types.js";
import type { CategoryConfig } from "./config.js";
import type { GitLogContext } from "./git-log.js";
import type { AgentId } from "./agents.js";
import type { EngineDependencies, EngineId } from "./engines/types.js";
import { runAnalysisEngine } from "./engines/run.js";
import { assertEngineLimits, resolveEngine } from "./engines/selection.js";

export const DEFAULT_MAX_TURNS = 200;
export const DEFAULT_MAX_BUDGET_USD = 0.50;
export const DEFAULT_TIMEOUT_MS = 120_000;

export interface AnalyzerOptions {
  engine?: EngineId;
  maxTurns?: number;
  maxBudgetUsd?: number;
  timeoutMs?: number;
  verbose?: boolean;
  categories?: string[];
  customCategories?: CategoryConfig[];
  gitLogContext?: GitLogContext | null;
  agent?: AgentId | null;
}

function validOutput(value: unknown): value is LLMAnalysisOutput {
  const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  return obj(value) && typeof value.summary === "string" && Array.isArray(value.categories) && value.categories.length > 0 && value.categories.every(cat =>
    obj(cat) && typeof cat.name === "string" && ["must", "nice", "optional"].includes(String(cat.tier)) &&
    typeof cat.score === "number" && Number.isFinite(cat.score) && cat.score >= 0 && cat.score <= 100 &&
    Array.isArray(cat.recommendations) && cat.recommendations.every(r => obj(r) && ["critical", "warning", "info"].includes(String(r.severity)) && typeof r.message === "string" && typeof r.action === "string") &&
    Array.isArray(cat.rawFindings) && cat.rawFindings.every(f => obj(f) && typeof f.item === "string" && typeof f.found === "boolean" && typeof f.details === "string"));
}

export async function analyzeRepository(repoPath: string, options: AnalyzerOptions = {}, dependencies: EngineDependencies = {}): Promise<LLMAnalysisOutput> {
  const engine = resolveEngine(options.engine);
  assertEngineLimits(engine, { maxBudget: options.maxBudgetUsd !== undefined, maxTurns: options.maxTurns !== undefined });
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxBudgetUsd = options.maxBudgetUsd ?? DEFAULT_MAX_BUDGET_USD;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(maxTurns) || maxTurns <= 0 || !Number.isFinite(maxBudgetUsd) || maxBudgetUsd <= 0 || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) throw new Error("분석 턴 수, 예산, 타임아웃은 유효한 양수여야 합니다");
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    const result = await runAnalysisEngine(engine, {
      repoPath, prompt: buildAnalysisPrompt(options.categories, options.customCategories, options.gitLogContext, options.agent),
      schema: ANALYSIS_JSON_SCHEMA, abortController, verbose: options.verbose,
      maxTurns: engine === "claude" ? maxTurns : undefined,
      maxBudgetUsd: engine === "claude" ? maxBudgetUsd : undefined,
    }, dependencies);
    if (!validOutput(result.output)) throw new Error("분석 결과가 올바른 카테고리·점수·권고 형식이 아닙니다");
    return result.output;
  } finally { clearTimeout(timer); }
}
