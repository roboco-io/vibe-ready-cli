import { describe, it, expect } from "vitest";
import { runAnalysisEngine } from "../../src/engines/run.js";
import { assertEngineLimits, parseEngine, resolveEngine } from "../../src/engines/selection.js";
import type { ClaudeQuery, EngineRequest } from "../../src/engines/types.js";

const request = (): EngineRequest => ({ repoPath: process.cwd(), prompt: "read only", schema: { type: "object", properties: {}, additionalProperties: false }, abortController: new AbortController(), maxTurns: 10, maxBudgetUsd: 0.5 });
describe("engine selection", () => {
  it("prefers CLI over configured engine and never guesses unknown engines", () => {
    expect(resolveEngine("codex", "claude")).toBe("codex");
    expect(resolveEngine(undefined, "codex")).toBe("codex");
    expect(resolveEngine()).toBe("claude");
    expect(() => parseEngine("cursor")).toThrow(/엔진/);
  });
  it("rejects unsupported Codex caps without treating CLI defaults as explicit", () => {
    expect(() => assertEngineLimits("codex", { maxBudget: true, maxTurns: false })).toThrow(/--max-budget/);
    expect(() => assertEngineLimits("codex", { maxBudget: false, maxTurns: true })).toThrow(/--max-turns/);
    expect(() => assertEngineLimits("codex", { maxBudget: false, maxTurns: false })).not.toThrow();
  });
});
describe("common analysis runner", () => {
  it("preserves Claude read-only tools, schema, hooks and usage accounting", async () => {
    const input = request(); let captured: Parameters<ClaudeQuery>[0] | undefined;
    const claudeQuery: ClaudeQuery = async function* (args) {
      captured = args;
      yield { type: "result", subtype: "success", structured_output: { answer: "ok" }, total_cost_usd: 0.2, num_turns: 4 };
    };
    const result = await runAnalysisEngine("claude", input, { claudeQuery });
    expect(result).toEqual({ engine: "claude", output: { answer: "ok" }, costUsd: 0.2, turns: 4 });
    expect(captured?.options?.tools).toEqual(["Read", "Glob", "Grep"]);
    expect(captured?.options?.permissionMode).toBe("dontAsk");
    expect(captured?.options?.outputFormat).toEqual({ type: "json_schema", schema: input.schema });
    expect(captured?.options?.abortController).toBe(input.abortController);
  });
  it("dispatches Codex without invoking Claude and does not fabricate USD cost", async () => {
    const result = await runAnalysisEngine("codex", { ...request(), maxTurns: undefined, maxBudgetUsd: undefined }, {
      claudeQuery: async function* () { throw new Error("wrong engine"); },
      codexRun: async () => ({ engine: "codex", output: { answer: "codex" } }),
    });
    expect(result.output).toEqual({ answer: "codex" });
    expect(result.costUsd).toBeUndefined();
  });
  it("refuses partial successful-looking data from failed turns", async () => {
    const claudeQuery: ClaudeQuery = async function* () { yield { type: "result", subtype: "error_max_budget_usd", structured_output: { answer: "partial" } }; };
    await expect(runAnalysisEngine("claude", request(), { claudeQuery })).rejects.toThrow(/예산/);
  });
  it("reports spent cost and a retry budget when the Claude budget is exceeded", async () => {
    const claudeQuery: ClaudeQuery = async function* () { yield { type: "result", subtype: "error_max_budget_usd", total_cost_usd: 0.5312, num_turns: 37 }; };
    await expect(runAnalysisEngine("claude", request(), { claudeQuery })).rejects.toThrow("분석 예산을 초과했습니다 (사용: $0.53 / 한도: $0.50, 37턴). --max-budget 1.50 이상으로 다시 실행해 보세요.");
  });
  it("falls back to the limit when the SDK omits spent cost", async () => {
    const claudeQuery: ClaudeQuery = async function* () { yield { type: "result", subtype: "error_max_budget_usd" }; };
    await expect(runAnalysisEngine("claude", request(), { claudeQuery })).rejects.toThrow("분석 예산을 초과했습니다 (한도: $0.50). --max-budget 1.00 이상으로 다시 실행해 보세요.");
  });
  it("honors an already cancelled invocation before either engine runs", async () => {
    const input = request(); input.abortController.abort();
    await expect(runAnalysisEngine("codex", input, { codexRun: async () => { throw new Error("should not run"); } })).rejects.toHaveProperty("name", "AbortError");
  });
});
