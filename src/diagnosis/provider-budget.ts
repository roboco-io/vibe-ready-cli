import type { Evidence, RemoteCollection } from "./types.js";

const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");

// Limit the serialized bytes, including escaped control characters and Unicode.
function clip(value: string, budget: number): string {
  if (bytes(value) <= budget) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (bytes(value.slice(0, mid)) <= budget - 8) low = mid;
    else high = mid - 1;
  }
  return `${value.slice(0, low)}…`;
}

export function boundRemoteCollection(result: RemoteCollection): RemoteCollection {
  let clipped = false;
  const text = (value: string, budget: number): string => {
    const bounded = clip(value, budget);
    if (bounded !== value) clipped = true;
    return bounded;
  };
  for (const pr of result.pullRequests) {
    pr.title = text(pr.title, 256);
    pr.body = text(pr.body, 800);
    pr.state = text(pr.state, 40);
    if (pr.headSha) pr.headSha = text(pr.headSha, 100);
    for (const review of pr.reviews) review.state = text(review.state, 40);
  }
  for (const run of result.ciRuns) {
    run.name = text(run.name, 256);
    run.status = text(run.status, 40);
    run.headSha = text(run.headSha, 100);
  }
  const original = result.evidence;
  result.evidence = [];
  // Reserve room for the single explanatory gap added below.
  const budget = Math.max(0, Math.min(500_000, 999_000 - bytes(result)));
  let used = 2;
  const add = (evidence: Evidence): boolean => {
    const size = bytes(evidence) + (result.evidence.length ? 1 : 0);
    if (used + size > budget || result.evidence.length >= 4000) { clipped = true; return false; }
    result.evidence.push(evidence);
    used += size;
    return true;
  };
  const core = original.filter(e => /^(?:pr|ci):\d+$/.test(e.id));
  // Core metadata gets priority even when early PRs have very verbose discussions.
  const overhead = core.reduce((sum, e) => sum + bytes({ ...e, summary: "" }) + 1, 0);
  const summaryBudget = Math.max(32, Math.min(1000, Math.floor((budget - overhead) / Math.max(1, core.length))));
  for (const evidence of core) add({ ...evidence, summary: text(evidence.summary, summaryBudget) });
  const groups = new Map<string, Evidence[]>();
  for (const evidence of original) {
    if (/^(?:pr|ci):\d+$/.test(evidence.id)) continue;
    const key = evidence.id.split(":").slice(0, 2).join(":");
    const group = groups.get(key) ?? [];
    group.push(evidence);
    groups.set(key, group);
  }
  // Round-robin across PR patches, discussions and CI job groups. Each excerpt
  // remains useful while no single long discussion consumes the whole budget.
  for (let index = 0; ; index++) {
    let remaining = false;
    for (const group of groups.values()) {
      if (!group[index]) continue;
      remaining = true;
      add({ ...group[index], summary: text(group[index].summary, 1800) });
    }
    if (!remaining) break;
  }
  if (clipped) {
    result.truncated = true;
    result.gaps.push("전체 근거 크기 제한(근거 500KB, 원격 수집 1MB)으로 본문을 발췌하고 일부 상세 근거를 생략했습니다. PR/CI 표본 메타데이터는 유지됩니다.");
  }
  return result;
}
