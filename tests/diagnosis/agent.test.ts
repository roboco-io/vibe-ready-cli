import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diagnoseRepository, resumeDiagnosis, type QueryRunner } from "../../src/diagnosis/agent.js";
import { getChecks } from "../../src/diagnosis/rubric.js";
import type { RemoteCollection, DiagnosisOutput } from "../../src/diagnosis/types.js";

const remote: RemoteCollection = { provider: "none", repository: null, pullRequests: [], ciRuns: [], evidence: [], gaps: ["원격 기록 없음"], truncated: false };
function result(): DiagnosisOutput {
  return { summary: "추가 확인이 필요합니다", findings: getChecks("general").map(c => ({ checkId: c.id, title: c.title, status: "unknown", observation: "근거 없음", hypothesis: "", impact: "", action: "", doneWhen: "", measure: "", confidence: "low", evidenceIds: [], codeEvidence: [] })),
    questions: [{ id: "q1", question: "검증은 언제 실행하나요?", reason: "실제 검증 흐름 확인", evidenceIds: [] }] };
}
async function withRepo(fn: (path: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), "diagnosis-agent-"));
  writeFileSync(join(root, "README.md"), "test\n");
  try { await fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
describe("diagnosis investigation", () => {
  it("blocks directory-wide Grep and secret files while permitting structured response delivery", async () => {
    await withRepo(async root => {
      writeFileSync(join(root, ".env"), "SECRET=private\n");
      const decisions: unknown[] = [];
      const query: QueryRunner = async function* (args) {
        const hook = args.options!.hooks!.PreToolUse![0].hooks[0];
        for (const [tool_name, tool_input] of [["Grep", { path: root, pattern: "." }], ["Grep", { path: join(root, ".env"), pattern: "." }], ["Read", { file_path: join(root, ".env") }], ["StructuredOutput", {}]] as const) {
          decisions.push(await hook({ hook_event_name: "PreToolUse", tool_name, tool_input, tool_use_id: "test", session_id: "test", transcript_path: "", cwd: root }, "test", { signal: new AbortController().signal }));
        }
        yield { type: "result", subtype: "success", structured_output: result(), total_cost_usd: 0.1, num_turns: 1 };
      };
      await diagnoseRepository(root, {}, { query, collect: async () => remote });
      for (const decision of decisions.slice(0, 3)) expect(decision).toMatchObject({ hookSpecificOutput: { permissionDecision: "deny" } });
      expect(decisions[3]).toEqual({});
    });
  });
  it("reports total deadline expiration in Korean even if the SDK returns its own abort error", async () => {
    await withRepo(async root => {
      const query: QueryRunner = async function* (args) {
        await new Promise<void>(resolve => args.options!.abortController!.signal.addEventListener("abort", () => resolve(), { once: true }));
        throw new Error("Claude Code process aborted by user");
      };
      await expect(diagnoseRepository(root, { timeoutMs: 10 }, { query, collect: async () => remote })).rejects.toThrow(/시간.*초과/);
    });
  });
  it("collects evidence, restricts SDK tools and completes without interactive input or target writes", async () => {
    await withRepo(async root => {
      let request: Parameters<QueryRunner>[0] | undefined;
      const query: QueryRunner = async function* (args) { request = args; yield { type: "result", subtype: "success", structured_output: result(), total_cost_usd: 0.1, num_turns: 2 }; };
      const snapshot = await diagnoseRepository(root, { provider: "none", profile: "general" }, { query, collect: async () => remote });
      expect(request?.options?.tools).toEqual(["Read", "Glob", "Grep"]);
      expect(request?.options?.permissionMode).toBe("dontAsk");
      expect(request?.options?.outputFormat?.type).toBe("json_schema");
      expect(snapshot.diagnosis.questions).toHaveLength(1);
      expect(snapshot.evidence.some(e => e.id === "repo:inventory")).toBe(true);
      expect(readdirSync(root)).toEqual(["README.md"]);
    });
  });
  it("uses interview answers as evidence and subtracts previous cost from synthesis budget", async () => {
    await withRepo(async root => {
      const budgets: number[] = []; let calls = 0;
      const query: QueryRunner = async function* (args) {
        budgets.push(args.options?.maxBudgetUsd ?? 0); calls++;
        const output = result();
        if (calls === 2) { output.findings[0].evidenceIds = ["interview:q1"]; output.summary = "팀 답변 반영"; }
        yield { type: "result", subtype: "success", structured_output: output, total_cost_usd: 0.1, num_turns: 1 };
      };
      const snapshot = await diagnoseRepository(root, { maxBudgetUsd: 0.5, interview: async () => ({ q1: "PR마다 실행합니다" }) }, { query, collect: async () => remote });
      expect(budgets).toEqual([0.5, 0.4]);
      expect(snapshot.answers.q1).toBe("PR마다 실행합니다");
      expect(snapshot.diagnosis.summary).toBe("팀 답변 반영");
      expect(snapshot.evidence.find(e => e.id === "interview:q1")?.summary).toContain("PR마다");
    });
  });
  it("does not start another paid query after budget exhaustion", async () => {
    await withRepo(async root => {
      let calls = 0;
      const query: QueryRunner = async function* () { calls++; yield { type: "result", subtype: "success", structured_output: result(), total_cost_usd: 0.5, num_turns: 1 }; };
      const snapshot = await diagnoseRepository(root, { interview: async () => ({ q1: "답변" }), maxBudgetUsd: 0.5 }, { query, collect: async () => remote });
      expect(calls).toBe(1);
      expect(snapshot.remote.gaps.join(" ")).toContain("예산");
    });
  });
  it("binds file answers to the saved interview instead of generating a new q1", async () => {
    await withRepo(async root => {
      const initialQuery: QueryRunner = async function* () { yield { type: "result", subtype: "success", structured_output: result(), total_cost_usd: 0.1, num_turns: 1 }; };
      const initial = await diagnoseRepository(root, {}, { query: initialQuery, collect: async () => remote });
      let calls = 0; let prompt = "";
      const resumedQuery: QueryRunner = async function* (args) {
        calls++; prompt = String(args.prompt);
        const final = result(); final.summary = "저장된 질문의 답변 반영";
        final.questions[0].question = "다른 질문을 만들면 안 됨";
        yield { type: "result", subtype: "success", structured_output: final, total_cost_usd: 0.1, num_turns: 1 };
      };
      const resumed = await resumeDiagnosis(root, initial, { answers: { q1: "PR마다 검증" } }, { query: resumedQuery, collect: async () => { throw new Error("must not fetch"); } });
      expect(calls).toBe(1);
      expect(prompt).toContain("검증은 언제 실행하나요?");
      expect(prompt).toContain("PR마다 검증");
      expect(resumed.diagnosis.questions[0].question).toBe("검증은 언제 실행하나요?");
      expect(resumed.window).toEqual(initial.window);
      expect(resumed.answers.q1).toBe("PR마다 검증");
    });
  });
  it("refuses stale repository evidence when resuming an interview", async () => {
    await withRepo(async root => {
      const query: QueryRunner = async function* () { yield { type: "result", subtype: "success", structured_output: result(), total_cost_usd: 0.1, num_turns: 1 }; };
      const initial = await diagnoseRepository(root, {}, { query, collect: async () => remote });
      writeFileSync(join(root, "README.md"), "changed\n");
      await expect(resumeDiagnosis(root, initial, { answers: { q1: "답변" } }, { query })).rejects.toThrow(/변경/);
    });
  });
  it("can resume unchanged citations whose secrets were redacted in the saved snapshot", async () => {
    await withRepo(async root => {
      writeFileSync(join(root, "README.md"), "password: ${{ secrets.DB_PASSWORD }}\n");
      const output = result();
      output.findings[0].status = "supported";
      output.findings[0].codeEvidence = [{ path: "README.md", line: 1, excerpt: "password: ${{ secrets.DB_PASSWORD }}" }];
      const query: QueryRunner = async function* () { yield { type: "result", subtype: "success", structured_output: output, total_cost_usd: 0.1, num_turns: 1 }; };
      const initial = await diagnoseRepository(root, {}, { query, collect: async () => remote });
      expect(initial.diagnosis.findings[0].codeEvidence[0].excerpt).toContain("REDACTED");
      const resumed = await resumeDiagnosis(root, initial, { answers: { q1: "PR마다 검증" } }, { query });
      expect(resumed.answers.q1).toBe("PR마다 검증");
    });
  });
  it("preserves the first grounded diagnosis if interview synthesis exhausts the budget", async () => {
    await withRepo(async root => {
      let calls = 0;
      const query: QueryRunner = async function* () {
        calls++;
        yield calls === 1 ? { type: "result", subtype: "success", structured_output: result(), total_cost_usd: 0.1, num_turns: 1 }
          : { type: "result", subtype: "error_max_budget_usd" };
      };
      const snapshot = await diagnoseRepository(root, { interview: async () => ({ q1: "PR마다 검증" }) }, { query, collect: async () => remote });
      expect(snapshot.diagnosis.summary).toBe("추가 확인이 필요합니다");
      expect(snapshot.remote.gaps.join(" ")).toContain("최초 진단");
      expect(snapshot.answers.q1).toBe("PR마다 검증");
    });
  });
  it("rejects failed SDK results even when they contain partial structured output", async () => {
    await withRepo(async root => {
      const query: QueryRunner = async function* () { yield { type: "result", subtype: "error_max_turns", structured_output: result() }; };
      await expect(diagnoseRepository(root, {}, { query, collect: async () => remote })).rejects.toThrow(/턴/);
    });
  });
});
