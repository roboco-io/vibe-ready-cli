import { describe, it, expect, vi } from "vitest";
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: () => { throw new Error("Unexpected live Claude query in test"); } }));
import { analyzeRepository } from "../src/analyzer.js";
import {
  DEFAULT_MAX_TURNS,
  DEFAULT_MAX_BUDGET_USD,
  DEFAULT_TIMEOUT_MS,
} from "../src/analyzer.js";

describe("analyzer default constants", () => {
  it("DEFAULT_MAX_TURNS should be 200", () => {
    expect(DEFAULT_MAX_TURNS).toBe(200);
  });

  it("DEFAULT_MAX_BUDGET_USD should be 2.00", () => {
    expect(DEFAULT_MAX_BUDGET_USD).toBe(2.00);
  });

  it("DEFAULT_TIMEOUT_MS should be 120000", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(120_000);
  });
});

describe("scoring engine selection", () => {
  it("runs Claude without a budget cap when the budget is unlimited", async () => {
    let options: Record<string, unknown> | undefined;
    const output = { categories: [{ name: "문서화 수준", tier: "nice", score: 80, recommendations: [], rawFindings: [] }], summary: "무제한" };
    await analyzeRepository(process.cwd(), { engine: "claude", maxBudgetUsd: Number.POSITIVE_INFINITY, categories: ["문서화 수준"] }, {
      claudeQuery: async function* (args) { options = args.options as Record<string, unknown>; yield { type: "result", subtype: "success", structured_output: output }; },
    });
    expect(options).toBeDefined();
    expect(options?.maxBudgetUsd).toBeUndefined();
  });
  it("uses Codex for scoring and retains a separate harness focus", async () => {
    let prompt = "";
    const output = { categories: [{ name: "문서화 수준", tier: "nice", score: 80, recommendations: [], rawFindings: [] }], summary: "Codex 분석" };
    const result = await analyzeRepository(process.cwd(), { engine: "codex", agent: "claude", categories: ["문서화 수준"] }, {
      claudeQuery: async function* () { throw new Error("wrong engine"); },
      codexRun: async request => { prompt = request.prompt; return { engine: "codex", output }; },
    });
    expect(result.summary).toBe("Codex 분석");
    expect(prompt).toContain("Claude Code");
  });
  it("rejects malformed structured scoring data before the scorer sees it", async () => {
    await expect(analyzeRepository(process.cwd(), { engine: "codex" }, {
      codexRun: async () => ({ engine: "codex", output: { categories: "invalid", summary: "bad" } }),
    })).rejects.toThrow(/분석 결과/);
  });
});
