import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildAnalysisPrompt } from "./prompts/analyze.js";
import type { LLMAnalysisOutput } from "./types.js";

const DEFAULT_MAX_TURNS = 5000;
const DEFAULT_MAX_BUDGET_USD = 1.00;
const DEFAULT_TIMEOUT_MS = 180_000;

export interface AnalyzerOptions {
  maxTurns?: number;
  maxBudgetUsd?: number;
  timeoutMs?: number;
  verbose?: boolean;
  categories?: string[];
}

export async function analyzeRepository(
  repoPath: string,
  options: AnalyzerOptions = {},
): Promise<LLMAnalysisOutput> {
  const {
    maxTurns = DEFAULT_MAX_TURNS,
    maxBudgetUsd = DEFAULT_MAX_BUDGET_USD,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    verbose = false,
    categories,
  } = options;

  if (verbose) {
    process.stderr.write(`[config] maxTurns=${maxTurns}, maxBudgetUsd=${maxBudgetUsd}, timeout=${timeoutMs}ms\n`);
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const prompt = buildAnalysisPrompt(categories);

    let resultText: string | null = null;
    let structuredOutput: unknown = null;

    for await (const message of query({
      prompt,
      options: {
        cwd: repoPath,
        tools: ["Read", "Glob", "Grep"],
        allowedTools: ["Read", "Glob", "Grep"],
        permissionMode: "dontAsk",
        maxTurns,
        maxBudgetUsd,
        abortController,
      },
    })) {
      if (verbose && "type" in message) {
        const msg = message as Record<string, unknown>;
        if (msg.type === "assistant") {
          process.stderr.write(".");
        }
      }

      if ("type" in message && message.type === "result") {
        const resultMsg = message as Record<string, unknown>;

        if (verbose) {
          process.stderr.write(`\n[result:${String(resultMsg.subtype)}]\n`);
        }

        if (resultMsg.structured_output) {
          structuredOutput = resultMsg.structured_output;
        }
        if (typeof resultMsg.result === "string") {
          resultText = resultMsg.result;
        }

        if (!structuredOutput && !resultText && resultMsg.subtype !== "success") {
          if (resultMsg.subtype === "error_max_turns") {
            throw new Error("LLM 에이전트가 최대 턴 수에 도달했습니다. --max-turns 값을 늘려보세요.");
          }
          if (resultMsg.subtype === "error_max_budget_usd") {
            throw new Error("분석 비용이 예산을 초과했습니다. --max-budget 값을 늘려보세요.");
          }
        }
      }
    }

    // structured_output 우선, 없으면 result 텍스트에서 JSON 추출
    if (structuredOutput) {
      return structuredOutput as LLMAnalysisOutput;
    }

    if (resultText) {
      return parseJsonFromText(resultText);
    }

    throw new Error("LLM이 분석 결과를 반환하지 않았습니다.");
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonFromText(text: string): LLMAnalysisOutput {
  // 직접 JSON 파싱 시도
  try {
    return JSON.parse(text) as LLMAnalysisOutput;
  } catch {
    // JSON이 마크다운 코드 블록 안에 있을 수 있음
  }

  // ```json ... ``` 블록에서 추출
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch?.[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1]) as LLMAnalysisOutput;
    } catch {
      // 파싱 실패 시 다음 시도
    }
  }

  // { 로 시작하는 가장 큰 JSON 블록 추출
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch?.[0]) {
    try {
      return JSON.parse(jsonMatch[0]) as LLMAnalysisOutput;
    } catch {
      // 최종 실패
    }
  }

  throw new Error("LLM 응답에서 JSON을 추출할 수 없습니다. 다시 시도해주세요.");
}
