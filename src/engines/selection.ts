import type { EngineId } from "./types.js";

/** Default Claude budget in USD; --no-max-budget replaces it with Infinity (no cap). */
export const DEFAULT_MAX_BUDGET_USD = 2.00;

export function parseEngine(value: unknown): EngineId {
  if (value !== "claude" && value !== "codex") throw new Error("분석 엔진은 claude 또는 codex여야 합니다");
  return value;
}
export function resolveEngine(cli?: unknown, configured?: unknown, fallback: EngineId = "claude"): EngineId {
  return parseEngine(cli ?? configured ?? fallback);
}
export function assertEngineLimits(engine: EngineId, explicit: { maxBudget: boolean; maxTurns: boolean }): void {
  if (engine !== "codex") return;
  const unsupported = [explicit.maxBudget ? "--max-budget" : "", explicit.maxTurns ? "--max-turns" : ""].filter(Boolean);
  if (unsupported.length) throw new Error(`Codex는 ${unsupported.join(", ")} 제한을 지원하지 않습니다. 해당 옵션을 빼고 --timeout을 사용하세요.`);
}
