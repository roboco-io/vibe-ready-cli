import { execFileSync } from "node:child_process";

export interface GitLogStats {
  totalCommits: number;
  issueRefRate: number; // 이슈 참조 커밋 비율 (0~100, 반올림)
  refBreakdown: {
    github: number;
    jira: number;
    keywords: number;
  };
  mergeCommitCount: number;
  prWorkflowDetected: boolean;
}

export interface GitLogContext extends GitLogStats {
  sampleSubjects: string[]; // 최근 커밋 제목 원문 (최대 50개)
}

const GITHUB_REF = /(?:#\d+|\bGH-\d+\b)/;
const JIRA_REF = /\b(?!GH-\d)[A-Z][A-Z0-9]+-\d+\b/;
const CLOSE_KEYWORD = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b/i;
const MERGE_COMMIT = /^Merge (?:pull request #\d+|branch )/;
const SQUASH_SUFFIX = /\(#\d+\)\s*$/;

export function computeGitLogStats(subjects: string[]): GitLogStats {
  let github = 0;
  let jira = 0;
  let keywords = 0;
  let refCommits = 0;
  let mergeCommitCount = 0;
  let squashCount = 0;

  for (const subject of subjects) {
    const hasGithub = GITHUB_REF.test(subject);
    const hasJira = JIRA_REF.test(subject);
    if (hasGithub) github++;
    if (hasJira) jira++;
    if (hasGithub || hasJira) {
      refCommits++;
      if (CLOSE_KEYWORD.test(subject)) keywords++;
    }
    if (MERGE_COMMIT.test(subject)) mergeCommitCount++;
    if (SQUASH_SUFFIX.test(subject)) squashCount++;
  }

  const total = subjects.length;
  return {
    totalCommits: total,
    issueRefRate: total === 0 ? 0 : Math.round((refCommits / total) * 100),
    refBreakdown: { github, jira, keywords },
    mergeCommitCount,
    prWorkflowDetected: mergeCommitCount > 0 || squashCount > 0,
  };
}
