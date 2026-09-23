import type { query } from "@anthropic-ai/claude-agent-sdk";

export type EngineId = "claude" | "codex";
export type ClaudeQuery = (args: Parameters<typeof query>[0]) => AsyncIterable<unknown>;
export interface EngineRequest {
  repoPath: string;
  prompt: string;
  schema: Record<string, unknown>;
  abortController: AbortController;
  maxTurns?: number;
  maxBudgetUsd?: number;
  /** Multi-pass callers: the user's whole budget and cost already spent, so budget errors describe the whole run. */
  budgetTotalUsd?: number;
  budgetSpentUsd?: number;
  verbose?: boolean;
  claudeHooks?: NonNullable<Parameters<typeof query>[0]["options"]>["hooks"];
}
export interface EngineResult {
  engine: EngineId;
  output: unknown;
  costUsd?: number;
  turns?: number;
}
export type EngineRunner = (request: EngineRequest) => Promise<EngineResult>;
export interface EngineDependencies {
  claudeQuery?: ClaudeQuery;
  codexRun?: EngineRunner;
}
