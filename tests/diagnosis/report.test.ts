import { describe, expect, it } from "vitest";
import { buildDiagnosisReport } from "../../src/diagnosis/report.js";
import { compareDiagnoses } from "../../src/diagnosis/compare.js";
import type { DiagnosisSnapshot, Finding, FindingStatus } from "../../src/diagnosis/types.js";

function finding(checkId: string, status: FindingStatus): Finding {
  return { checkId, status, title: checkId, observation: "관찰", hypothesis: "가설", impact: "영향", action: "실험 실행", doneWhen: "완료 기준", measure: "측정 기준", confidence: "high", evidenceIds: ["pr:1", "interview:q1"], codeEvidence: [{ path: "src/main.ts", line: 8, excerpt: "return true;" }] };
}
function snapshot(findings: Finding[] = [finding("acceptance", "gap")]): DiagnosisSnapshot {
  return {
    schemaVersion: 1, rubricVersion: "v1", createdAt: "2026-09-20", repository: "github.com/org/repo", repoPath: "/repo", commit: "abc", profile: "cli", goal: "피드백 단축", window: { since: "2026-08-21", until: "2026-09-20", days: 30, limit: 30 },
    remote: { provider: "github", repository: "org/repo", pullRequests: [], ciRuns: [], evidence: [], gaps: ["리뷰 권한 부족"], truncated: true },
    evidence: [{ id: "pr:1", source: "pull-request", locator: "https://github.com/org/repo/pull/1", summary: "변경 근거" }, { id: "interview:q1", source: "interview", locator: "q1", summary: "팀 답변" }],
    metrics: { pullRequests: 5, mergedPullRequests: 3, leadTimeHours: { median: 24, samples: 2 }, firstReviewHours: { median: null, samples: 0 }, ciRuns: 4, completedCiRuns: 3, failedCiRuns: 1, retriedCiRuns: 2 },
    answers: { q1: "매주 점검합니다" }, diagnosis: { summary: "개선 여지", findings, questions: [{ id: "q1", question: "언제 점검하나요?", reason: "권한 부족", evidenceIds: ["pr:1"] }] },
  };
}

describe("diagnosis report", () => {
  it("shows saved engine provenance and treats legacy snapshots as Claude", () => {
    const legacy = snapshot();
    const codex = { ...snapshot(), engine: "codex" as const };
    expect(buildDiagnosisReport(legacy)).toContain("Claude Agent SDK");
    expect(buildDiagnosisReport(codex)).toContain("Codex CLI");
    expect(() => compareDiagnoses(legacy, codex)).toThrow(/엔진/);
    expect(() => compareDiagnoses(legacy, { ...legacy, engine: "claude" })).not.toThrow();
  });
  it("renders scope, denominators, evidence, questions and actionable findings", () => {
    const text = buildDiagnosisReport(snapshot());
    for (const part of ["개선 여지", "cli", "피드백 단축", "2026-08-21", "30", "표본", "잘림", "리뷰 권한 부족", "2/3", "0/5", "1/3", "2/4", "초안 시간 포함 가능", "https://github.com/org/repo/pull/1", "src/main.ts:8", "return true;", "interview:q1", "가설", "실험 실행", "완료 기준", "측정 기준", "언제 점검하나요?", "매주 점검합니다"])
      expect(text).toContain(part);
  });
  it("ranks only three actionable problems deterministically and retains all statuses", () => {
    const data = snapshot([finding("z", "partial"), finding("b", "gap"), finding("a", "gap"), finding("c", "gap"), finding("ok", "supported"), finding("unk", "unknown"), finding("na", "not-applicable")]);
    const text = buildDiagnosisReport(data);
    const priority = text.split("## 우선 실행 과제")[1].split("## 전체 진단")[0];
    expect(priority.indexOf("a")).toBeLessThan(priority.indexOf("b"));
    expect(priority).not.toContain("z");
    expect(text).toContain("부분 충족");
    expect(text).toContain("판단 불가");
    expect(text).toContain("해당 없음");
  });
  it("escapes markdown and terminal controls, rejects unsafe links, and redacts recognizable credentials", () => {
    const data = snapshot();
    data.answers.q1 = "token=super-secret-value\n|[evil](javascript:alert(1))\u001b[31m";
    data.evidence[0].locator = "javascript:alert(1)";
    const text = buildDiagnosisReport(data);
    expect(text).not.toContain("super-secret-value");
    expect(text).not.toContain("](javascript:");
    expect(text).not.toContain("\u001b");
    expect(text).toContain("\\|");
  });
  it("never restores redacted credentials inside URL link targets", () => {
    const data = snapshot();
    data.evidence[0].locator = "https://example.com/ghp_secretcredential";
    expect(buildDiagnosisReport(data)).not.toContain("ghp_secretcredential");
  });
  it("retains safe review anchors and distinguishes provider window timestamps", () => {
    const data = snapshot();
    data.evidence[0].locator = "https://github.com/org/repo/pull/1#discussion_r123";
    const report = buildDiagnosisReport(data);
    expect(report).toContain("](https://github.com/org/repo/pull/1#discussion_r123)");
    expect(report).toContain("PR/MR 갱신 시각");
    expect(report).toContain("GitHub CI 생성 시각");
    expect(report).toContain("GitLab CI 갱신 시각");
  });
});

describe("diagnosis comparison", () => {
  it("requires explicit supported evidence to resolve and classifies all problem transitions", () => {
    const before = snapshot([finding("resolve", "gap"), finding("persist", "partial"), finding("unknown", "gap"), finding("missing", "gap"), finding("na", "partial"), finding("new", "supported")]);
    const after = snapshot([finding("resolve", "supported"), finding("persist", "gap"), finding("unknown", "unknown"), finding("na", "not-applicable"), finding("new", "partial"), finding("added", "gap")]);
    expect(compareDiagnoses(before, after)).toMatchObject({ resolved: ["resolve"], persisting: ["persist"], unconfirmed: ["missing", "na", "unknown"], introduced: ["added", "new"] });
  });
  it.each(["schemaVersion", "rubricVersion", "repository", "profile", "goal", "days"])("rejects incompatible %s", key => {
    const before = snapshot();
    const after = snapshot();
    if (key === "days") after.window.days = 7;
    else Object.assign(after, { [key]: key === "schemaVersion" ? 2 : "different" });
    expect(() => compareDiagnoses(before, after)).toThrow(/비교/);
  });
  it("displays changed sample/window context without causal claims", () => {
    const before = snapshot();
    const after = snapshot();
    after.window.until = "2026-10-20";
    after.window.limit = 10;
    after.metrics.pullRequests = 2;
    const comparison = compareDiagnoses(before, after);
    expect(comparison.notes.join(" ")).toContain("표본");
    expect(comparison.notes.join(" ")).toContain("기간");
    expect(buildDiagnosisReport(after, comparison)).toContain("인과관계");
  });
});
