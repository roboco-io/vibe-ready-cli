import { getChecks, PROFILES, readRepositoryFile } from "./rubric.js";
import { redactText } from "./redact.js";
import { parseEngine } from "../engines/selection.js";
import type { CodeEvidence, DiagnosisOutput, DiagnosisSnapshot, Evidence, Finding, Profile } from "./types.js";

const STATUSES = ["supported", "partial", "gap", "unknown", "not-applicable"];
export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: 객체가 필요합니다`);
  return value as Record<string, unknown>;
}
export function string(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > 20_000) throw new Error(`${label}: 유효한 문자열이 필요합니다`);
  return value;
}
function array(value: unknown, label: string, max = 1000): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label}: 유효한 배열이 필요합니다`);
  return value;
}
function references(value: unknown, ids: Set<string>): string[] {
  const refs = array(value, "근거 ID", 50).map(v => string(v, "근거 ID"));
  if (refs.some(id => !ids.has(id))) throw new Error("수집되지 않은 근거 ID입니다");
  return [...new Set(refs)];
}
function citation(value: unknown, repoPath?: string, redacted = false): CodeEvidence {
  const c = object(value, "코드 근거");
  const path = string(c.path, "근거 경로");
  const excerpt = string(c.excerpt, "근거 인용");
  if (!Number.isInteger(c.line) || Number(c.line) < 1 || excerpt.length > 2000) throw new Error("코드 근거의 행 번호 또는 인용이 올바르지 않습니다");
  if (repoPath) {
    try {
      const text = readRepositoryFile(repoPath, path).split(/\r?\n/).slice(Number(c.line) - 1).join("\n");
      if (!(redacted ? redactText(text) : text).startsWith(excerpt.replace(/\r\n/g, "\n"))) throw new Error("인용 불일치");
    } catch { throw new Error(`코드 근거를 확인할 수 없습니다: ${path}:${c.line}`); }
  }
  return { path, line: Number(c.line), excerpt };
}
export function validateDiagnosisOutput(raw: unknown, evidence: Evidence[], profile: Profile, repoPath?: string, redactedCitations = false): DiagnosisOutput {
  const obj = object(raw, "진단 응답");
  const ids = new Set(evidence.map(e => e.id));
  const expected = getChecks(profile).map(c => c.id);
  const seen = new Set<string>();
  const findings = array(obj.findings, "진단 항목", expected.length).map(value => {
    const f = object(value, "진단 항목");
    const checkId = string(f.checkId, "항목 ID");
    if (!expected.includes(checkId) || seen.has(checkId)) throw new Error("알 수 없거나 중복된 진단 항목입니다");
    seen.add(checkId);
    if (!STATUSES.includes(String(f.status))) throw new Error("알 수 없는 진단 상태입니다");
    if (!["high", "medium", "low"].includes(String(f.confidence))) throw new Error("진단 확신 수준이 올바르지 않습니다");
    const evidenceIds = references(f.evidenceIds, ids);
    const codeEvidence = array(f.codeEvidence, "코드 근거", 10).map(c => citation(c, repoPath, redactedCitations));
    if (f.status !== "unknown" && !evidenceIds.length && !codeEvidence.length) throw new Error("확정적인 진단에는 확인 가능한 근거가 필요합니다");
    const actionable = f.status === "gap" || f.status === "partial";
    return { checkId, status: f.status, title: string(f.title, "진단 제목"), observation: string(f.observation, "관찰"),
      hypothesis: string(f.hypothesis, "가설", true), impact: string(f.impact, "영향", !actionable),
      action: string(f.action, "개선 작업", !actionable), doneWhen: string(f.doneWhen, "완료 조건", !actionable),
      measure: string(f.measure, "효과 확인", !actionable), confidence: f.status === "unknown" ? "low" : f.confidence,
      evidenceIds, codeEvidence } as Finding;
  });
  if (seen.size !== expected.length) throw new Error("모든 진단 항목이 필요합니다. 근거가 부족한 항목은 unknown으로 반환하세요");
  const questionIds = new Set<string>();
  const questions = array(obj.questions, "인터뷰 질문", 3).map(value => {
    const q = object(value, "인터뷰 질문");
    const id = string(q.id, "질문 ID");
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(id) || questionIds.has(id)) throw new Error("질문 ID가 올바르지 않거나 중복되었습니다");
    questionIds.add(id);
    return { id, question: string(q.question, "질문"), reason: string(q.reason, "질문 이유"), evidenceIds: references(q.evidenceIds, ids) };
  });
  return { summary: string(obj.summary, "진단 요약"), findings, questions };
}

export function validateAnswers(raw: unknown): Record<string, string> {
  const obj = object(raw, "인터뷰 답변");
  if (Object.keys(obj).length > 50) throw new Error("인터뷰 답변은 50개 이하여야 합니다");
  const answers: Record<string, string> = Object.create(null);
  for (const [id, value] of Object.entries(obj)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(id)) throw new Error("인터뷰 답변 ID가 올바르지 않습니다");
    answers[id] = string(value, "인터뷰 답변", true);
  }
  return answers;
}

export function validateSnapshot(raw: unknown): DiagnosisSnapshot {
  const s = object(raw, "진단 스냅샷");
  const engine = s.engine === undefined ? "claude" : parseEngine(s.engine);
  if (s.schemaVersion !== 1) throw new Error("지원하지 않는 진단 스냅샷 버전입니다");
  for (const key of ["rubricVersion", "repository", "repoPath", "goal", "createdAt"]) string(s[key], `스냅샷 ${key}`);
  if (!PROFILES.includes(s.profile as Profile)) throw new Error("스냅샷 프로필이 올바르지 않습니다");
  if (!Number.isFinite(Date.parse(String(s.createdAt)))) throw new Error("스냅샷 생성 시각이 올바르지 않습니다");
  if (s.commit !== null) string(s.commit, "커밋");
  const window = object(s.window, "분석 기간");
  if (![window.since, window.until].every(v => typeof v === "string" && Number.isFinite(Date.parse(v))) || Date.parse(String(window.since)) >= Date.parse(String(window.until))) throw new Error("분석 기간이 올바르지 않습니다");
  for (const key of ["days", "limit"]) if (!Number.isInteger(window[key]) || Number(window[key]) <= 0) throw new Error("분석 범위가 올바르지 않습니다");
  const evidence = array(s.evidence, "수집 근거", 5000).map(value => {
    const e = object(value, "수집 근거");
    if (!["repository", "pull-request", "review", "ci", "interview"].includes(String(e.source))) throw new Error("근거 종류가 올바르지 않습니다");
    return { ...e, id: string(e.id, "근거 ID"), locator: string(e.locator, "근거 위치"), summary: string(e.summary, "근거 요약", true) } as Evidence;
  });
  if (new Set(evidence.map(e => e.id)).size !== evidence.length) throw new Error("중복된 근거 ID입니다");
  const metrics = object(s.metrics, "진단 지표");
  for (const key of ["pullRequests", "mergedPullRequests", "ciRuns", "failedCiRuns", "completedCiRuns", "retriedCiRuns"]) {
    if (!Number.isInteger(metrics[key]) || Number(metrics[key]) < 0) throw new Error("진단 지표가 올바르지 않습니다");
  }
  for (const key of ["leadTimeHours", "firstReviewHours"]) {
    const d = object(metrics[key], "시간 지표");
    if (!Number.isInteger(d.samples) || Number(d.samples) < 0 || !(d.median === null || typeof d.median === "number" && Number.isFinite(d.median) && d.median >= 0)) throw new Error("시간 지표가 올바르지 않습니다");
  }
  const remote = object(s.remote, "원격 수집");
  if (!["none", "github", "gitlab"].includes(String(remote.provider)) || typeof remote.truncated !== "boolean") throw new Error("원격 수집 정보가 올바르지 않습니다");
  array(remote.gaps, "수집 누락").forEach(g => string(g, "수집 누락"));
  array(remote.pullRequests, "PR 기록"); array(remote.ciRuns, "CI 기록"); array(remote.evidence, "원격 근거", 5000);
  const diagnosis = validateDiagnosisOutput(s.diagnosis, evidence, s.profile as Profile);
  const answers = validateAnswers(s.answers);
  return { ...s, engine, evidence, diagnosis, answers } as unknown as DiagnosisSnapshot;
}
