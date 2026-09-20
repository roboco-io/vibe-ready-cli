import { describe, it, expect } from "vitest";
import { collectRemoteEvidence } from "../../src/diagnosis/providers.js";
const now = new Date("2026-09-20T00:00:00Z");
const date = "2026-09-19T00:00:00Z";
const pr = (number = 1, updated_at = date) => ({ number, title: "Validate input", body: "Acceptance: reject invalid values", created_at: "2026-09-10T00:00:00Z", updated_at, merged_at: null, state: "open", draft: false, head: { sha: "abc" } });
function mock(handler: (url: URL) => unknown | Response) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    expect(init?.method).toBe("GET"); expect(init?.redirect).toBe("error");
    const value = handler(new URL(String(input)));
    return value instanceof Response ? value : Response.json(value);
  }) as typeof fetch;
}
const opts = { remoteUrl: "git@github.com:org/repo.git", days: 30, limit: 5, now, env: {} };
describe("remote evidence", () => {
  it("normalizes open PRs, review bodies, CI retries and canonical identity", async () => {
    const result = await collectRemoteEvidence(".", { ...opts, fetch: mock(u => {
      if (u.pathname.endsWith("/pulls")) { expect(u.searchParams.get("state")).toBe("all"); expect(u.searchParams.get("sort")).toBe("updated"); return [pr()]; }
      if (u.pathname.endsWith("/reviews")) return [{ id: 7, submitted_at: date, state: "APPROVED", body: "Verified boundary case tests" }];
      if (u.pathname.endsWith("/runs")) { expect(u.searchParams.get("created")).toContain("2026-08-21"); return { workflow_runs: [{ id: 4, name: "tests", created_at: date, updated_at: date, status: "completed", conclusion: "failure", head_sha: "abc", run_attempt: 2 }] }; }
      return u.pathname.endsWith("/jobs") ? { jobs: [] } : [];
    }) });
    expect(result.repository).toBe("https://github.com/org/repo");
    expect(result.pullRequests[0]).toMatchObject({ state: "open", headSha: "abc", reviews: [{ state: "APPROVED", submittedAt: date }] });
    expect(result.ciRuns[0]).toMatchObject({ attempt: 2, status: "failure" });
    expect(result.evidence.some(e => e.summary.includes("Verified boundary case tests"))).toBe(true);
    expect(result.gaps).toEqual([]);
  });
  it("preserves partial results and never serializes tokens or provider error text", async () => {
    const result = await collectRemoteEvidence(".", { ...opts, env: { GH_TOKEN: "top-secret" }, fetch: mock(u => u.pathname.endsWith("/pulls") ? [pr()] : new Response("top-secret https://user:pass@host/?token=secret", { status: 401 })) });
    expect(result.pullRequests).toHaveLength(1); expect(result.gaps.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("top-secret"); expect(JSON.stringify(result)).not.toContain("user:pass");
  });
  it("honors page bounds, updated window and marks truncation", async () => {
    const result = await collectRemoteEvidence(".", { ...opts, limit: 1, fetch: mock(u => u.pathname.endsWith("/pulls") ? [pr(), pr(2)] : u.pathname.endsWith("/runs") ? { workflow_runs: [] } : []) });
    expect(result.pullRequests).toHaveLength(1); expect(result.truncated).toBe(true);
    const old = await collectRemoteEvidence(".", { ...opts, fetch: mock(u => u.pathname.endsWith("/pulls") ? [pr(1, "2020-01-01T00:00:00Z")] : u.pathname.endsWith("/runs") ? { workflow_runs: [] } : []) });
    expect(old.pullRequests).toEqual([]);
  });
  it("reports malformed data and rejects invalid options without requests", async () => {
    const result = await collectRemoteEvidence(".", { ...opts, fetch: mock(() => ({ unexpected: true })) });
    expect(result.gaps.length).toBeGreaterThan(0);
    await expect(collectRemoteEvidence(".", { ...opts, days: 0 })).rejects.toThrow();
    const offline = await collectRemoteEvidence(".", { ...opts, provider: "none" });
    expect(offline.provider).toBe("none"); expect(offline.gaps.length).toBeGreaterThan(0);
  });
  it("collects GitLab MR notes and pipeline retry jobs using encoded project and window", async () => {
    const result = await collectRemoteEvidence(".", { ...opts, provider: "gitlab", remoteUrl: "https://gitlab.example/team/sub/repo.git", fetch: mock(u => {
      expect(u.pathname).toContain("team%2Fsub%2Frepo");
      if (u.pathname.endsWith("/merge_requests")) { expect(u.searchParams.get("updated_after")).toBe("2026-08-21T00:00:00.000Z"); return [{ iid: 2, title: "MR", description: "Test plan: boundary tests", created_at: date, updated_at: date, merged_at: null, state: "opened", draft: false, sha: "abc" }]; }
      if (u.pathname.endsWith("/notes")) return [{ id: 3, body: "Please add error handling tests", created_at: date, system: false }];
      if (u.pathname.endsWith("/pipelines")) return [{ id: 10, status: "success", created_at: date, updated_at: date, sha: "abc" }];
      if (u.pathname.endsWith("/jobs")) { expect(u.searchParams.get("include_retried")).toBe("true"); return [{ id: 1, name: "test", retried: true }, { id: 2, name: "test", retried: false }]; }
      return { id: 10, status: "success", created_at: date, updated_at: date, sha: "abc", started_at: date, finished_at: date };
    }) });
    expect(result.repository).toBe("https://gitlab.example/team/sub/repo");
    expect(result.pullRequests[0].body).toContain("Test plan"); expect(result.ciRuns[0].attempt).toBe(2);
    expect(result.evidence.some(e => e.summary.includes("error handling"))).toBe(true);
  });
  it("paginates with generated URLs and keeps earlier records after a later failure", async () => {
    const pages: number[] = [];
    const result = await collectRemoteEvidence(".", { ...opts, fetch: mock(u => {
      if (u.pathname.endsWith("/pulls")) {
        pages.push(Number(u.searchParams.get("page")));
        return pages.length === 1 ? Response.json([pr()], { headers: { link: "<https://evil.example/steal>; rel=\"next\"" } }) : new Response("not available", { status: 503 });
      }
      if (u.pathname.endsWith("/runs")) return { workflow_runs: [] };
      expect(u.hostname).toBe("api.github.com"); return [];
    }) });
    expect(pages).toEqual([1, 2]); expect(result.pullRequests).toHaveLength(1);
    expect(result.gaps.some(g => g.includes("503"))).toBe(true);
  });
  it("redacts reflected environment secrets and URL credentials from evidence", async () => {
    const result = await collectRemoteEvidence(".", { ...opts, remoteUrl: "https://username:password@github.com/org/repo.git", env: { GITHUB_TOKEN: "sensitive-token" }, fetch: mock(u => {
      if (u.pathname.endsWith("/pulls")) return [{ ...pr(), body: "sensitive-token https://user:password@example.com/test?access_token=other-secret" }];
      return u.pathname.endsWith("/runs") ? { workflow_runs: [] } : [];
    }) });
    expect(result.repository).toBe("https://github.com/org/repo");
    const json = JSON.stringify(result);
    for (const value of ["sensitive-token", "password", "other-secret", "access_token"]) expect(json).not.toContain(value);
    expect(result.pullRequests[0].body).toContain("[REDACTED]");
  });
  it("rejects unrecognized remotes and respects pre-aborted collection", async () => {
    let calls = 0;
    const fetch = mock(() => { calls++; return []; });
    const invalid = await collectRemoteEvidence(".", { ...opts, remoteUrl: "https://unknown.example/org/repo", fetch });
    expect(invalid.provider).toBe("none"); expect(invalid.gaps.length).toBeGreaterThan(0);
    const aborted = await collectRemoteEvidence(".", { ...opts, signal: AbortSignal.abort(), fetch });
    expect(aborted.truncated).toBe(true); expect(aborted.gaps.length).toBeGreaterThan(0); expect(calls).toBe(0);
  });
  it("reports malformed records rather than pretending an empty complete collection", async () => {
    const result = await collectRemoteEvidence(".", { ...opts, fetch: mock(u => u.pathname.endsWith("/pulls") ? [{ number: 1, updated_at: date }] : { workflow_runs: [{ id: 2, created_at: "invalid" }] }) });
    expect(result.pullRequests).toEqual([]); expect(result.ciRuns).toEqual([]); expect(result.gaps).toHaveLength(2);
  });

  it("marks malformed review records as missing review evidence", async () => {
    const result = await collectRemoteEvidence(".", { ...opts, fetch: mock(u => u.pathname.endsWith("/pulls") ? [pr()] : u.pathname.endsWith("/reviews") ? [{}] : u.pathname.endsWith("/runs") ? { workflow_runs: [] } : []) });
    expect(result.pullRequests).toHaveLength(1);
    expect(result.gaps.some(g => g.includes("리뷰/댓글"))).toBe(true);
  });

  it("provides bounded changed-file patches and failed GitHub step evidence with token redaction", async () => {
    const result = await collectRemoteEvidence(".", { ...opts, fetch: mock(u => {
      if (u.pathname.endsWith("/pulls")) return [pr()];
      if (u.pathname.endsWith("/files")) return [{ filename: "src/input.ts", status: "modified", additions: 4, deletions: 1, patch: "+ rejectInvalid(value); // ghp_abcdefghijklmnopqrstuvwxyz1234567890" }];
      if (u.pathname.endsWith("/runs")) return { workflow_runs: [{ id: 4, name: "tests", created_at: date, updated_at: date, status: "completed", conclusion: "failure", head_sha: "abc", run_attempt: 2 }] };
      if (u.pathname.endsWith("/jobs")) return { jobs: [{ id: 8, name: "unit tests", conclusion: "failure", steps: [{ name: "input validation tests", conclusion: "failure", number: 2 }] }] };
      return [];
    }) });
    expect(result.evidence.find(e => e.id === "pr-file:1:0")?.summary).toContain("rejectInvalid(value)");
    expect(result.evidence.find(e => e.id === "ci-job:4:8")?.summary).toContain("input validation tests");
    expect(JSON.stringify(result)).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz1234567890");
  });
  it("provides GitLab diff and failed job reason, marking clipped patches", async () => {
    const result = await collectRemoteEvidence(".", { ...opts, provider: "gitlab", remoteUrl: "https://gitlab.com/org/repo.git", fetch: mock(u => {
      if (u.pathname.endsWith("/merge_requests")) return [{ iid: 2, title: "MR", description: "Acceptance", created_at: date, updated_at: date, state: "opened" }];
      if (u.pathname.endsWith("/diffs")) return [{ new_path: "lib/input.ts", diff: "+ glpat-abcdefghijklmnopqrst github_pat_abcdefghijklmnopqrst\n" + "x".repeat(4000) }];
      if (u.pathname.endsWith("/pipelines")) return [{ id: 10, status: "failed", created_at: date, updated_at: date, sha: "abc" }];
      if (u.pathname.endsWith("/jobs")) return [{ id: 5, name: "integration", status: "failed", failure_reason: "script_failure" }];
      if (u.pathname.endsWith("/10")) return { id: 10, status: "failed", created_at: date, sha: "abc" };
      return [];
    }) });
    expect(result.evidence.find(e => e.id === "pr-file:2:0")?.summary).toContain("lib/input.ts");
    expect(result.evidence.find(e => e.id === "ci-job:10:5")?.summary).toContain("script_failure");
    expect(result.truncated).toBe(true);
    expect(JSON.stringify(result)).not.toContain("glpat-abcdefghijklmnopqrst");
    expect(JSON.stringify(result)).not.toContain("github_pat_abcdefghijklmnopqrst");
  });

  it("bounds dense Unicode evidence while retaining PR and CI sample metadata", async () => {
    const dense = "한글로 작성된 상세 검증 결과와 경계 조건 설명. ".repeat(150);
    const result = await collectRemoteEvidence(".", { ...opts, limit: 100, fetch: mock(u => {
      const page = Number(u.searchParams.get("page"));
      if (u.pathname.endsWith("/pulls")) return page === 1 ? Array.from({ length: 100 }, (_, i) => ({ ...pr(i + 1), title: dense, body: dense })) : [];
      if (u.pathname.endsWith("/runs")) return { workflow_runs: page === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: dense, created_at: date, status: "completed", conclusion: "success", head_sha: "abc" })) : [] };
      if (u.pathname.endsWith("/files")) return Array.from({ length: 10 }, (_, i) => ({ filename: `src/file-${i}.ts`, patch: dense }));
      return Array.from({ length: 30 }, (_, i) => ({ id: i + 1, body: dense, submitted_at: date, created_at: date, state: "APPROVED" }));
    }) });
    expect(Buffer.byteLength(JSON.stringify(result.evidence))).toBeLessThanOrEqual(500_000);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(1_000_000);
    expect(result.evidence.length).toBeLessThan(5000);
    expect(result.pullRequests).toHaveLength(100);
    expect(result.ciRuns).toHaveLength(100);
    expect(result.evidence.some(e => e.id === "pr:100")).toBe(true);
    expect(result.evidence.some(e => e.id === "ci:100")).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.gaps.some(g => g.includes("크기"))).toBe(true);
  });

});
