import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeGitLogStats, collectGitLogContext } from "../src/git-log.js";

describe("computeGitLogStats", () => {
  it("GitHub 이슈 참조(#N, GH-N)를 카운트한다", () => {
    const stats = computeGitLogStats([
      "feat: add login (#12)",
      "fix: GH-34 button alignment",
      "chore: update deps",
    ]);
    expect(stats.refBreakdown.github).toBe(2);
    expect(stats.refBreakdown.jira).toBe(0);
    expect(stats.issueRefRate).toBe(67); // 2/3 반올림
  });

  it("Jira 참조(ABC-123)를 카운트하되 GH-N은 제외한다", () => {
    const stats = computeGitLogStats([
      "PROJ-101 implement search",
      "fix: GH-7 typo",
      "docs: readme",
    ]);
    expect(stats.refBreakdown.jira).toBe(1);
    expect(stats.refBreakdown.github).toBe(1);
  });

  it("closes/fixes/resolves 키워드는 이슈 참조 동반 시에만 카운트한다", () => {
    const stats = computeGitLogStats([
      "fix: closes #5 null check",
      "fix: resolves crash on boot", // 참조 없음 → 제외
      "feat: fixes PROJ-9 pagination",
    ]);
    expect(stats.refBreakdown.keywords).toBe(2);
  });

  it("머지 커밋과 squash 패턴으로 PR 워크플로를 감지한다", () => {
    const merged = computeGitLogStats([
      "Merge pull request #6 from org/feat",
      "feat: something",
    ]);
    expect(merged.mergeCommitCount).toBe(1);
    expect(merged.prWorkflowDetected).toBe(true);

    const squashed = computeGitLogStats(["feat: add cache (#21)"]);
    expect(squashed.mergeCommitCount).toBe(0);
    expect(squashed.prWorkflowDetected).toBe(true);

    const none = computeGitLogStats(["feat: add cache"]);
    expect(none.prWorkflowDetected).toBe(false);
  });

  it("단어에 붙은 #N과 단일 문자 프리픽스 Jira 패턴은 제외한다", () => {
    const stats = computeGitLogStats([
      "refactor: rename foo#12bar helper",
      "fix: A-1 edge case",
    ]);
    expect(stats.refBreakdown.github).toBe(0);
    expect(stats.refBreakdown.jira).toBe(0);
    expect(stats.issueRefRate).toBe(0);
  });

  it("빈 배열은 0 통계를 반환한다", () => {
    const stats = computeGitLogStats([]);
    expect(stats.totalCommits).toBe(0);
    expect(stats.issueRefRate).toBe(0);
    expect(stats.prWorkflowDetected).toBe(false);
  });
});

describe("collectGitLogContext", () => {
  it("git 리포지토리가 아니면 null을 반환한다", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-ready-test-"));
    try {
      expect(collectGitLogContext(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("git 리포지토리에서 통계와 샘플을 반환한다", () => {
    // 이 프로젝트 자체가 git 리포지토리이므로 그대로 사용
    const ctx = collectGitLogContext(process.cwd());
    expect(ctx).not.toBeNull();
    expect(ctx!.totalCommits).toBeGreaterThan(0);
    expect(ctx!.sampleSubjects.length).toBeGreaterThan(0);
    expect(ctx!.sampleSubjects.length).toBeLessThanOrEqual(50);
  });
});
