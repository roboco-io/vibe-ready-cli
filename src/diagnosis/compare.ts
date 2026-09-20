import type { DiagnosisComparison, DiagnosisSnapshot, Finding } from "./types.js";

function isProblem(finding: Finding | undefined): boolean {
  return finding?.status === "gap" || finding?.status === "partial";
}

export function compareDiagnoses(before: DiagnosisSnapshot, after: DiagnosisSnapshot): DiagnosisComparison {
  const dimensions = ["schemaVersion", "rubricVersion", "repository", "profile", "goal"] as const;
  for (const key of dimensions) {
    if (before[key] !== after[key]) throw new Error(`진단 비교 불가: ${key} 값이 다릅니다.`);
  }
  if (before.window.days !== after.window.days) throw new Error("진단 비교 불가: 관찰 기간 길이가 다릅니다.");
  const result: DiagnosisComparison = { resolved: [], persisting: [], introduced: [], unconfirmed: [], notes: [] };
  const previous = new Map(before.diagnosis.findings.map(f => [f.checkId, f]));
  const current = new Map(after.diagnosis.findings.map(f => [f.checkId, f]));
  const ids = [...new Set([...previous.keys(), ...current.keys()])].sort();
  for (const id of ids) {
    const oldFinding = previous.get(id);
    const newFinding = current.get(id);
    if (isProblem(oldFinding)) {
      if (newFinding?.status === "supported") result.resolved.push(id);
      else if (isProblem(newFinding)) result.persisting.push(id);
      else result.unconfirmed.push(id);
    } else if (isProblem(newFinding)) result.introduced.push(id);
  }
  if (before.window.since !== after.window.since || before.window.until !== after.window.until) {
    result.notes.push(`관찰 기간 변경: ${before.window.since} ~ ${before.window.until} → ${after.window.since} ~ ${after.window.until}`);
  }
  if (before.window.limit !== after.window.limit || JSON.stringify(before.metrics) !== JSON.stringify(after.metrics)) {
    result.notes.push(`표본 변경: PR/MR ${before.metrics.pullRequests} → ${after.metrics.pullRequests}, CI ${before.metrics.ciRuns} → ${after.metrics.ciRuns}, 수집 상한 ${before.window.limit} → ${after.window.limit}`);
  }
  if (before.remote.provider !== after.remote.provider || before.remote.truncated !== after.remote.truncated || JSON.stringify(before.remote.gaps) !== JSON.stringify(after.remote.gaps)) {
    result.notes.push("수집 제공자, 잘림 여부 또는 누락 근거가 달라졌습니다. 관찰 범위를 함께 검토하세요.");
  }
  result.notes.push("동일 항목의 관찰 결과 비교이며, 개선 활동과 변화의 인과관계를 입증하지 않습니다.");
  return result;
}
