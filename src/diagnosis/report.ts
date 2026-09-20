import type { DiagnosisComparison, DiagnosisSnapshot, Finding, FindingStatus } from "./types.js";

const statuses: Record<FindingStatus, string> = { supported: "충족", partial: "부분 충족", gap: "개선 필요", unknown: "판단 불가", "not-applicable": "해당 없음" };

// Output is untrusted prose: remove recognizable credentials and terminal controls,
// then escape Markdown syntax so evidence cannot inject headings, links or HTML.
function redact(value: string): string {
  return value
    .replace(/\b(?:github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+|glpat-[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]+)\b/g, "[비밀값 숨김]")
    .replace(/\b(authorization\s*:\s*(?:bearer|basic)|bearer|(?:api[_-]?key|token|password|secret)\s*[:=])\s*[^\s,;]+/gi, "$1 [비밀값 숨김]");
}

function safe(value: string): string {
  return redact(value)
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\\`*_[\]{}()#!|]/g, "\\$&");
}

function locator(value: string): string {
  if (redact(value) !== value) return safe(value);
  try {
    const url = new URL(value);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password && !url.search) {
      const target = url.href.replace(/[()[\]<>`\s\\|]/g, c => encodeURIComponent(c).replace(/\(/g, "%28").replace(/\)/g, "%29"));
      return `[${safe(url.href)}](${target})`;
    }
    if (url.protocol === "https:" || url.protocol === "http:") return safe(`${url.origin}${url.pathname}`);
  } catch { /* Repository and interview locators are plain text. */ }
  return safe(value);
}

export function buildDiagnosisReport(snapshot: DiagnosisSnapshot, comparison?: DiagnosisComparison): string {
  const { metrics: m, diagnosis: d, window: w } = snapshot;
  const evidence = new Map(snapshot.evidence.map(item => [item.id, item]));
  const lines = ["# 개발 프로세스 진단", "", safe(d.summary), "", "## 관찰 범위", "",
    `- 저장소: ${safe(snapshot.repository)} / 커밋: ${safe(snapshot.commit ?? "알 수 없음")}`,
    `- 프로필: ${safe(snapshot.profile)} / 목표: ${safe(snapshot.goal)}`,
    `- 기간: ${safe(w.since)} ~ ${safe(w.until)} (${w.days}일), 수집 상한: 각 ${w.limit}개`,
    `- 제공자: ${safe(snapshot.remote.provider)} / 표본: PR/MR ${m.pullRequests}개, CI ${m.ciRuns}개 / 잘림: ${snapshot.remote.truncated ? "있음" : "없음"}`,
    "- 관찰 기간 기준: PR/MR 갱신 시각, GitHub CI 생성 시각, GitLab CI 갱신 시각. 제한된 표본을 조직 전체의 성과로 일반화하지 않습니다.",
    `- 스키마: ${snapshot.schemaVersion} / 평가 기준: ${safe(snapshot.rubricVersion)} / 생성: ${safe(snapshot.createdAt)}`,
    "", "## 수집 공백", "", ...snapshot.remote.gaps.map(g => `- ${safe(g)}`)];
  if (!snapshot.remote.gaps.length) lines.push("- 보고된 수집 공백 없음");
  const duration = (value: number | null) => value === null ? "알 수 없음" : `${value}시간`;
  lines.push("", "## 관찰 지표", "", "| 지표 | 결과 | 관찰 분모 |", "| --- | --- | --- |",
    `| 병합 PR/MR | ${m.mergedPullRequests}개 | ${m.mergedPullRequests}/${m.pullRequests} |`,
    `| PR 생성→병합 중앙값 | ${duration(m.leadTimeHours.median)} | ${m.leadTimeHours.samples}/${m.mergedPullRequests} 병합 표본 |`,
    `| PR 생성→첫 리뷰(초안 시간 포함 가능) 중앙값 | ${duration(m.firstReviewHours.median)} | ${m.firstReviewHours.samples}/${m.pullRequests} PR/MR 표본 |`,
    `| 종료 CI | ${m.completedCiRuns}개 | ${m.completedCiRuns}/${m.ciRuns} |`,
    `| 실패 CI | ${m.failedCiRuns}개 | ${m.failedCiRuns}/${m.completedCiRuns} 종료 CI |`,
    `| 재시도 관찰 CI | ${m.retriedCiRuns}개 | ${m.retriedCiRuns}/${m.ciRuns} 전체 CI |`,
    "", "PR 병합 시간은 배포 리드타임이 아닙니다. CI 재시도는 불안정성의 확정 증거가 아닙니다.");
  const rank = { high: 0, medium: 1, low: 2 };
  const compareId = (a: Finding, b: Finding) => a.checkId < b.checkId ? -1 : a.checkId > b.checkId ? 1 : 0;
  const top = d.findings.filter(f => (f.status === "gap" || f.status === "partial") && f.action.trim() && f.doneWhen.trim() && f.measure.trim())
    .sort((a, b) => Number(a.status === "partial") - Number(b.status === "partial") || rank[a.confidence] - rank[b.confidence] || compareId(a, b)).slice(0, 3);
  lines.push("", "## 우선 실행 과제", "", "개선 필요 → 부분 충족, 신뢰도, 항목 ID 순으로 최대 3개를 선정했습니다.", "");
  if (!top.length) lines.push("실행 조건이 확인된 개선 과제가 없습니다.");
  top.forEach((f, i) => lines.push(`${i + 1}. ${safe(f.checkId)} — ${safe(f.title)}: ${safe(f.action)} (완료: ${safe(f.doneWhen)} / 측정: ${safe(f.measure)})`));
  const cite = (id: string) => {
    const e = evidence.get(id);
    return e ? `${safe(id)} — ${locator(e.locator)}: ${safe(e.summary)}` : `${safe(id)} — 근거를 찾을 수 없음`;
  };
  lines.push("", "## 전체 진단", "");
  for (const f of [...d.findings].sort(compareId)) {
    lines.push(`### ${safe(f.checkId)} — ${safe(f.title)} [${statuses[f.status]}]`, "",
      `- 관찰: ${safe(f.observation)}`, `- 가설(검증 필요): ${safe(f.hypothesis)}`, `- 영향: ${safe(f.impact)}`,
      `- 실행: ${safe(f.action)}`, `- 완료 기준: ${safe(f.doneWhen)}`, `- 성공 측정: ${safe(f.measure)}`, `- 신뢰도: ${safe(f.confidence)}`,
      ...f.evidenceIds.map(id => `- 근거: ${cite(id)}`),
      ...f.codeEvidence.map(e => `- 코드 근거: ${safe(e.path)}:${e.line} — ${safe(e.excerpt)}`), "");
  }
  lines.push("## 팀 인터뷰", "");
  if (!d.questions.length) lines.push("추가 질문 없음");
  for (const q of d.questions) lines.push(`- ${safe(q.id)}: ${safe(q.question)}`, `  - 질문 이유: ${safe(q.reason)}`, ...q.evidenceIds.map(id => `  - 근거: ${cite(id)}`), `  - 답변: ${safe(snapshot.answers[q.id] ?? "미응답")}`);
  for (const [id, answer] of Object.entries(snapshot.answers).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!d.questions.some(q => q.id === id)) lines.push(`- 이전 인터뷰 ${safe(id)} 답변: ${safe(answer)}`);
  }
  if (comparison) {
    lines.push("", "## 이전 진단과 비교", "");
    for (const [key, label] of [["resolved", "해결 확인"], ["persisting", "지속"], ["introduced", "새로 관찰"], ["unconfirmed", "해결 미확인"]] as const) lines.push(`- ${label}: ${comparison[key].length ? comparison[key].map(safe).join(", ") : "없음"}`);
    lines.push(...comparison.notes.map(note => `- ${safe(note)}`), "- 전후 관찰의 차이로 인과관계를 단정할 수 없습니다.");
  }
  return `${lines.join("\n")}\n`;
}
