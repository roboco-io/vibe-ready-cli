import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDiagnosisCli } from "../../src/diagnosis/cli.js";
import type { DiagnosisSnapshot } from "../../src/diagnosis/types.js";

vi.mock("../../src/diagnosis/agent.js", () => ({
  resumeDiagnosis: vi.fn(async (_repo: string, snapshot: DiagnosisSnapshot, options: { answers?: Record<string, string> }) => ({ ...snapshot, answers: options.answers ?? {} })),
  diagnoseRepository: vi.fn(async () => { throw new Error("예상하지 않은 새 진단 호출"); }),
}));

let root: string;
let repo: string;
let input: string;
function fixture(): DiagnosisSnapshot {
  return { schemaVersion: 1, rubricVersion: "process-1", createdAt: "2026-09-20T00:00:00Z", repository: "local:test", repoPath: repo, commit: null, profile: "general", goal: "피드백 개선",
    window: { since: "2026-08-21T00:00:00Z", until: "2026-09-20T00:00:00Z", days: 30, limit: 30 },
    remote: { provider: "none", repository: null, pullRequests: [], ciRuns: [], evidence: [], gaps: ["원격 미수집"], truncated: false }, evidence: [],
    metrics: { pullRequests: 0, mergedPullRequests: 0, leadTimeHours: { median: null, samples: 0 }, firstReviewHours: { median: null, samples: 0 }, ciRuns: 0, failedCiRuns: 0, completedCiRuns: 0, retriedCiRuns: 0 }, answers: {},
    diagnosis: { summary: "오프라인 진단", findings: ["acceptance", "reproducibility", "verification", "feedback", "changeability", "traceability", "delivery"].map(checkId => ({ checkId, title: checkId, status: "unknown", observation: "근거 부족", hypothesis: "", impact: "", action: "", doneWhen: "", measure: "", confidence: "low", evidenceIds: [], codeEvidence: [] })), questions: [{ id: "q1", question: "어떻게 검증하나요?", reason: "근거 부족", evidenceIds: [] }] } };
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "diagnosis-cli-"));
  repo = join(root, "repo"); mkdirSync(repo);
  writeFileSync(join(repo, "source.ts"), "source unchanged");
  input = join(root, "input.json"); writeFileSync(input, JSON.stringify(fixture()));
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); rmSync(root, { recursive: true, force: true }); });

describe("diagnosis CLI", () => {
  it("replays a snapshot without SDK/network and writes only explicit external files", async () => {
    const output = join(root, "report.md"); const save = join(root, "saved.json");
    await runDiagnosisCli(repo, { diagnosisFile: input, output, saveDiagnosis: save, interview: true });
    expect(readFileSync(output, "utf8")).toContain("오프라인 진단");
    expect(readFileSync(output, "utf8")).toContain("미응답");
    expect(JSON.parse(readFileSync(save, "utf8")).schemaVersion).toBe(1);
    expect(readdirSync(repo)).toEqual(["source.ts"]);
  });
  it("emits valid JSON and comparison without implicit writes", async () => {
    await runDiagnosisCli(repo, { diagnosisFile: input, json: true, baseline: input });
    const data = JSON.parse(vi.mocked(console.log).mock.calls.at(-1)![0]);
    expect(data.schemaVersion).toBe(1);
    expect(data.comparison.unconfirmed).toEqual([]);
    expect(readdirSync(root).sort()).toEqual(["input.json", "repo"]);
  });
  it("resumes original saved questions with file answers", async () => {
    const answers = join(root, "answers.json");
    writeFileSync(answers, JSON.stringify({ q1: "기존 질문에 대한 답변" }));
    await runDiagnosisCli(repo, { diagnosisFile: input, answers, json: true });
    const result = JSON.parse(vi.mocked(console.log).mock.calls.at(-1)![0]);
    expect(result.diagnosis.questions[0].question).toBe("어떻게 검증하나요?");
    expect(result.answers.q1).toBe("기존 질문에 대한 답변");
  });
  it("rejects ungrounded answers before starting a new diagnosis", async () => {
    const answers = join(root, "answers.json");
    writeFileSync(answers, JSON.stringify({ q1: "다른 질문의 답변" }));
    await expect(runDiagnosisCli(repo, { answers })).rejects.toThrow(/--diagnosis-file/);
  });
  it("rejects an oversized generated snapshot before writing any output", async () => {
    const { diagnoseRepository } = await import("../../src/diagnosis/agent.js");
    const snapshot = fixture();
    snapshot.remote.ciRuns.push({ id: "run1", url: "https://example.com/run1", name: "CI", status: "success", createdAt: snapshot.createdAt, headSha: "abc", detail: "x".repeat(5 * 1024 * 1024) } as typeof snapshot.remote.ciRuns[number]);
    vi.mocked(diagnoseRepository).mockResolvedValueOnce(snapshot);
    const save = join(root, "too-large.json");
    const output = join(root, "report.md");
    await expect(runDiagnosisCli(repo, { saveDiagnosis: save, output })).rejects.toThrow(/크기|5MB/);
    expect(readdirSync(root).sort()).toEqual(["input.json", "repo"]);
  });
  it.each([{ days: "0" }, { days: "3651" }, { days: "1.5" }, { limit: "101" }, { limit: "0" }, { maxTurns: "1.1" }, { maxBudget: "NaN" }, { timeout: "0" }, { provider: "other" }, { profile: "other" }, { category: "ci" }, { branch: "main" }, { agent: "codex" }, { pdf: "x.pdf" }])("rejects invalid options before collection: %j", async options => {
    await expect(runDiagnosisCli(repo, options)).rejects.toThrow();
    expect(readdirSync(repo)).toEqual(["source.ts"]);
  });
  it("blocks source writes including parent symlinks and existing external files", async () => {
    symlinkSync(repo, join(root, "alias"));
    for (const output of [join(repo, "source.ts"), join(repo, "new.md"), join(root, "alias", "new.md"), input]) {
      await expect(runDiagnosisCli(repo, { diagnosisFile: input, output })).rejects.toThrow(/저장|출력|덮어/);
    }
    expect(readFileSync(join(repo, "source.ts"), "utf8")).toBe("source unchanged");
  });
  it("rejects malformed snapshots, oversized JSON, duplicate output destinations and malformed answers", async () => {
    writeFileSync(input, "{}");
    await expect(runDiagnosisCli(repo, { diagnosisFile: input })).rejects.toThrow();
    writeFileSync(input, " ".repeat(5 * 1024 * 1024 + 1));
    await expect(runDiagnosisCli(repo, { diagnosisFile: input })).rejects.toThrow(/크기/);
    writeFileSync(input, JSON.stringify(fixture()));
    const destination = join(root, "out.json");
    await expect(runDiagnosisCli(repo, { diagnosisFile: input, output: destination, saveDiagnosis: destination })).rejects.toThrow(/같은|동일/);
    const answers = join(root, "answers.json"); writeFileSync(answers, "[]");
    await expect(runDiagnosisCli(repo, { diagnosisFile: input, answers })).rejects.toThrow(/답변/);
  });
});
