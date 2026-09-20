import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeDiagnosisMetrics } from "../../src/diagnosis/metrics.js";
import { detectProfile, getChecks } from "../../src/diagnosis/rubric.js";
import type { RemoteCollection, PullRequestRecord } from "../../src/diagnosis/types.js";

const pr = (fields: Partial<PullRequestRecord>): PullRequestRecord => ({
  id: "1", url: "https://github.com/a/b/pull/1", title: "change", body: "", state: "closed", draft: false,
  createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-02T00:00:00Z", mergedAt: null, reviews: [], ...fields,
});
describe("diagnosis metrics", () => {
  it("keeps missing measurements unknown rather than inventing healthy zeroes", () => {
    const result = computeDiagnosisMetrics({ pullRequests: [], ciRuns: [] });
    expect(result.leadTimeHours).toEqual({ median: null, samples: 0 });
    expect(result.firstReviewHours).toEqual({ median: null, samples: 0 });
  });
  it("counts observed events and ignores invalid time pairs without changing denominators", () => {
    const input: Pick<RemoteCollection, "pullRequests" | "ciRuns"> = {
      pullRequests: [pr({ mergedAt: "2026-09-03T00:00:00Z", reviews: [{ submittedAt: "2026-09-01T06:00:00Z", state: "COMMENTED" }, { submittedAt: "2026-09-01T02:00:00Z", state: "APPROVED" }] }),
        pr({ id: "2", mergedAt: "2026-09-02T00:00:00Z" }), pr({ id: "3", createdAt: "invalid", mergedAt: "2026-09-02T00:00:00Z" })],
      ciRuns: ["success", "failure", "cancelled", "in_progress"].map((status, i) => ({ id: String(i), url: "https://example.com", name: "ci", status, createdAt: "2026-09-01T00:00:00Z", headSha: "abc", attempt: i === 0 ? 2 : 1 })),
    };
    expect(computeDiagnosisMetrics(input)).toEqual({ pullRequests: 3, mergedPullRequests: 3,
      leadTimeHours: { median: 36, samples: 2 }, firstReviewHours: { median: 2, samples: 1 },
      ciRuns: 4, failedCiRuns: 1, completedCiRuns: 3, retriedCiRuns: 1 });
  });
});
describe("project profiles", () => {
  it("uses CLI behavior and leaves unrecognized repositories general", () => {
    const root = mkdtempSync(join(tmpdir(), "diagnosis-profile-"));
    try {
      expect(detectProfile(root)).toBe("general");
      writeFileSync(join(root, "package.json"), JSON.stringify({ bin: { tool: "index.js" } }));
      expect(detectProfile(root)).toBe("cli");
      expect(getChecks("cli").find(c => c.id === "delivery")?.question).toContain("종료 코드");
      expect(getChecks("service").find(c => c.id === "delivery")?.question).toContain("복구");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
