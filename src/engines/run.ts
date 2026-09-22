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
    maxTurns: request.maxTurns, maxBudgetUsd: request.maxBudgetUsd, abortController: request.abortController,
  } })) {
    request.abortController.signal.throwIfAborted();
    if (!raw || typeof raw !== "object") throw new Error("분석 엔진 메시지 형식이 올바르지 않습니다");
    const message = raw as Record<string, unknown>;
    if (request.verbose && message.type === "assistant") process.stderr.write(".");
    if (message.type !== "result") continue;
    if (message.subtype !== "success") {
      if (message.subtype === "error_max_turns") throw new Error("분석이 최대 턴 수에 도달했습니다. --max-turns를 늘려보세요.");
      if (message.subtype === "error_max_budget_usd") throw new Error("분석 예산을 초과했습니다. --max-budget을 늘려보세요.");
      throw new Error("Claude 분석이 정상 완료되지 않았습니다");
    }
    const output = message.structured_output ?? (typeof message.result === "string" ? parseEngineJson(message.result) : undefined);
    if (output === undefined || output === null) throw new Error("분석 엔진이 결과를 반환하지 않았습니다");
    result = {
      engine, output,
      costUsd: typeof message.total_cost_usd === "number" && Number.isFinite(message.total_cost_usd) && message.total_cost_usd >= 0 ? message.total_cost_usd : undefined,
      turns: typeof message.num_turns === "number" && Number.isInteger(message.num_turns) && message.num_turns >= 0 ? message.num_turns : undefined,
    };
  }
  if (!result) throw new Error("분석 엔진이 결과를 반환하지 않았습니다");
  return result;
}
