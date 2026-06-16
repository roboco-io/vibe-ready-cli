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

const GITHUB_REF = /(?:(?<!\w)#\d+\b|\bGH-\d+\b)/;
// 앞에 영숫자가 없는 "PREFIX-숫자" 형태를 Jira 이슈 키 후보로 본다.
const JIRA_REF = /(?<![A-Za-z0-9])([A-Z]{2,10})-\d{1,6}\b/g;
// 이슈 키가 아니라 표준/스펙/인코딩/암호 토큰인 흔한 약어 — 오탐 방지 (예: UTF-8, SHA-1, HTTP-2, ISO-8601)
const JIRA_DENYLIST = new Set([
  "GH", "UTF", "SHA", "MD", "HTTP", "HTTPS", "ISO", "IEEE", "RFC",
  "AES", "RSA", "TLS", "SSL", "EC", "ES", "CVE", "ASCII", "UCS", "X",
]);

function hasJiraRef(subject: string): boolean {
  for (const m of subject.matchAll(JIRA_REF)) {
    if (!JIRA_DENYLIST.has(m[1])) return true;
  }
  return false;
}

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
    const hasJira = hasJiraRef(subject);
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

const MAX_COMMITS = 200;
const MAX_SAMPLES = 50;

// 환경에 GIT_DIR / GIT_WORK_TREE 가 설정된 경우 cwd 의 .git 을 사용하도록 제거
function cleanGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env["GIT_DIR"];
  delete env["GIT_WORK_TREE"];
  delete env["GIT_INDEX_FILE"];
  return env;
}

export function collectGitLogContext(repoPath: string, verbose = false): GitLogContext | null {
  let output: string;
  try {
    output = execFileSync("git", ["log", `-${MAX_COMMITS}`, "--pretty=%s"], {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      env: cleanGitEnv(),
    });
  } catch (e) {
    if (verbose) {
      const reason = e instanceof Error ? e.message : String(e);
      process.stderr.write(`\n[git-log] 커밋 히스토리를 수집할 수 없습니다: ${reason}\n`);
    }
    return null;
  }

  const subjects = output.split("\n").filter((s) => s.trim().length > 0);
  if (subjects.length === 0) return null;

  return {
    ...computeGitLogStats(subjects),
    sampleSubjects: subjects.slice(0, MAX_SAMPLES),
  };
}
