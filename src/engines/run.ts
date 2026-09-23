import type { EngineDependencies, EngineId, EngineRequest, EngineResult } from "./types.js";
import { assertEngineLimits, parseEngine } from "./selection.js";

export function parseEngineJson(text: string): unknown {
  const candidates = [text, text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)?.[1], text.match(/\{[\s\S]*\}/)?.[0]];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { return JSON.parse(candidate); } catch { /* Try the next supported wrapping. */ }
  }
  throw new Error("분석 엔진 응답에서 JSON을 추출할 수 없습니다");
}

function finiteCost(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

// Suggest double the larger of spent cost and limit, rounded up to $0.50, since a stopped run's final cost is unknown.
export function budgetExceededMessage(costUsd: number | undefined, limitUsd: number | undefined, turns: unknown): string {
  const usage = [costUsd === undefined ? "" : `사용: $${costUsd.toFixed(2)}`, limitUsd === undefined ? "" : `한도: $${limitUsd.toFixed(2)}`].filter(Boolean).join(" / ");
  const detail = [usage, typeof turns === "number" && Number.isInteger(turns) && turns >= 0 ? `${turns}턴` : ""].filter(Boolean).join(", ");
  const base = Math.max(costUsd ?? 0, limitUsd ?? 0);
  const retry = base > 0 ? ` --max-budget ${(Math.ceil(base * 2 * 2) / 2).toFixed(2)} 이상으로 다시 실행해 보세요.` : " --max-budget을 늘려보세요.";
  return `분석 예산을 초과했습니다${detail ? ` (${detail})` : ""}.${retry}`;
}

export async function runAnalysisEngine(engine: EngineId, request: EngineRequest, dependencies: EngineDependencies = {}): Promise<EngineResult> {
  request.abortController.signal.throwIfAborted();
  parseEngine(engine);
  if (engine === "codex") {
    assertEngineLimits(engine, { maxBudget: request.maxBudgetUsd !== undefined, maxTurns: request.maxTurns !== undefined });
    const run = dependencies.codexRun ?? (await import("./codex.js")).runCodex;
    return run(request);
  }
  const query = dependencies.claudeQuery ?? (await import("@anthropic-ai/claude-agent-sdk")).query;
  let result: EngineResult | undefined;
  for await (const raw of query({ prompt: request.prompt, options: {
    cwd: request.repoPath, tools: ["Read", "Glob", "Grep"], allowedTools: ["Read", "Glob", "Grep"], permissionMode: "dontAsk",
    settingSources: [], mcpServers: {}, hooks: request.claudeHooks,
    outputFormat: { type: "json_schema", schema: request.schema },
    // Infinity means --no-max-budget: omit the SDK cap entirely.
    maxTurns: request.maxTurns, maxBudgetUsd: Number.isFinite(request.maxBudgetUsd) ? request.maxBudgetUsd : undefined, abortController: request.abortController,
  } })) {
    request.abortController.signal.throwIfAborted();
    if (!raw || typeof raw !== "object") throw new Error("분석 엔진 메시지 형식이 올바르지 않습니다");
    const message = raw as Record<string, unknown>;
    if (request.verbose && message.type === "assistant") process.stderr.write(".");
    if (message.type !== "result") continue;
    if (message.subtype !== "success") {
      if (message.subtype === "error_max_turns") throw new Error("분석이 최대 턴 수에 도달했습니다. --max-turns를 늘려보세요.");
      if (message.subtype === "error_max_budget_usd") {
        const cost = finiteCost(message.total_cost_usd);
        throw new Error(budgetExceededMessage(cost === undefined ? undefined : (request.budgetSpentUsd ?? 0) + cost, request.budgetTotalUsd ?? request.maxBudgetUsd, message.num_turns));
      }
      throw new Error("Claude 분석이 정상 완료되지 않았습니다");
    }
    const output = message.structured_output ?? (typeof message.result === "string" ? parseEngineJson(message.result) : undefined);
    if (output === undefined || output === null) throw new Error("분석 엔진이 결과를 반환하지 않았습니다");
    result = {
      engine, output,
      costUsd: finiteCost(message.total_cost_usd),
      turns: typeof message.num_turns === "number" && Number.isInteger(message.num_turns) && message.num_turns >= 0 ? message.num_turns : undefined,
    };
  }
  if (!result) throw new Error("분석 엔진이 결과를 반환하지 않았습니다");
  return result;
}
