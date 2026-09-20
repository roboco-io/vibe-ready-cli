import type { DiagnosisMetrics, RemoteCollection } from "./types.js";

function hours(start: string, end: string): number | null {
  const value = (Date.parse(end) - Date.parse(start)) / 3_600_000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function distribution(values: number[]): { median: number | null; samples: number } {
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  const median = !values.length ? null : values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return { median: median === null ? null : Math.round(median * 100) / 100, samples: values.length };
}

export function computeDiagnosisMetrics(data: Pick<RemoteCollection, "pullRequests" | "ciRuns">): DiagnosisMetrics {
  const lead: number[] = [];
  const review: number[] = [];
  for (const pr of data.pullRequests) {
    if (pr.mergedAt) {
      const value = hours(pr.createdAt, pr.mergedAt);
      if (value !== null) lead.push(value);
    }
    const times = pr.reviews.map(r => hours(pr.createdAt, r.submittedAt)).filter((n): n is number => n !== null);
    if (times.length) review.push(Math.min(...times));
  }
  const completed = new Set(["success", "failure", "failed", "cancelled", "canceled", "timed_out", "neutral", "skipped", "action_required", "stale"]);
  const failed = new Set(["failure", "failed", "timed_out", "action_required"]);
  return {
    pullRequests: data.pullRequests.length,
    mergedPullRequests: data.pullRequests.filter(p => p.mergedAt).length,
    leadTimeHours: distribution(lead), firstReviewHours: distribution(review),
    ciRuns: data.ciRuns.length,
    failedCiRuns: data.ciRuns.filter(r => failed.has(r.status)).length,
    completedCiRuns: data.ciRuns.filter(r => completed.has(r.status)).length,
    retriedCiRuns: data.ciRuns.filter(r => (r.attempt ?? 1) > 1).length,
  };
}
