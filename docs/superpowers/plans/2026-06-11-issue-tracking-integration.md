# 이슈 트래킹 연동 분석 카테고리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** vibe-ready-cli에 7번째 분석 카테고리 "이슈 트래킹 연동"을 추가 — Node에서 커밋 로그 통계를 사전 추출해 LLM 프롬프트에 주입하고, 커밋 이슈 참조율·PR 워크플로·템플릿·강제 장치 4종 신호로 평가한다.

**Architecture:** 신규 모듈 `src/git-log.ts`가 `git log`를 읽기 전용 실행해 통계(이슈 참조율, 머지 비율)와 커밋 제목 샘플 50개를 수집한다. `index.ts`가 분석 전에 이를 호출해 `analyzer.ts` → `buildAnalysisPrompt`로 전달하고, LLM은 주입된 통계 + 기존 `Read`/`Glob`/`Grep` 도구로 7번째 카테고리를 평가한다. SDK 도구 권한은 변경 없음.

**Tech Stack:** TypeScript (ESM, `.js` import 확장자 필수), Node.js `child_process.execFileSync`, vitest

**Spec:** `docs/superpowers/specs/2026-06-11-issue-tracking-integration-design.md`

---

## 파일 구조

| 파일 | 작업 | 책임 |
|---|---|---|
| `src/git-log.ts` | 생성 | 커밋 제목 수집 + 통계 계산 (순수 함수 분리) |
| `src/types.ts` | 수정 | `CATEGORY_WEIGHTS`에 7번째 카테고리, nice 가중치 0.10 재분배 |
| `src/prompts/analyze.ts` | 수정 | `ALL_CATEGORIES` + 카테고리 섹션 + Git Log Context 주입 |
| `src/analyzer.ts` | 수정 | `AnalyzerOptions.gitLogContext` 전달 |
| `src/index.ts` | 수정 | 분석 전 `collectGitLogContext` 호출 (단일/멀티 브랜치) |
| `tests/git-log.test.ts` | 생성 | 통계 계산·실패 처리 테스트 |
| `tests/scorer.test.ts` | 수정 | 가중치 합 1.0 검증 추가 |
| `tests/analyze-prompt.test.ts` | 수정 | gitLogContext 주입/폴백 테스트 추가 |
| `CLAUDE.md`, `README.md` | 수정 | 카테고리 표·아키텍처·데이터 플로우 갱신 |

---

### Task 1: git-log 통계 계산 순수 함수

**Files:**
- Create: `src/git-log.ts`
- Test: `tests/git-log.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/git-log.test.ts` 생성:

```ts
import { describe, it, expect } from "vitest";
import { computeGitLogStats } from "../src/git-log.js";

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

  it("빈 배열은 0 통계를 반환한다", () => {
    const stats = computeGitLogStats([]);
    expect(stats.totalCommits).toBe(0);
    expect(stats.issueRefRate).toBe(0);
    expect(stats.prWorkflowDetected).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/git-log.test.ts`
Expected: FAIL — `Cannot find module '../src/git-log.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/git-log.ts` 생성:

```ts
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/git-log.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/git-log.ts tests/git-log.test.ts
git commit -m "feat: 커밋 로그 이슈 참조 통계 계산 함수 추가"
```

---

### Task 2: collectGitLogContext — git 실행 및 실패 처리

**Files:**
- Modify: `src/git-log.ts` (파일 끝에 추가)
- Test: `tests/git-log.test.ts` (describe 블록 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/git-log.test.ts` 상단 import 수정 및 describe 추가:

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeGitLogStats, collectGitLogContext } from "../src/git-log.js";
```

파일 끝에 추가:

```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/git-log.test.ts`
Expected: FAIL — `collectGitLogContext` is not exported

- [ ] **Step 3: 구현 작성**

`src/git-log.ts` 파일 끝에 추가:

```ts
const MAX_COMMITS = 200;
const MAX_SAMPLES = 50;

export function collectGitLogContext(repoPath: string, verbose = false): GitLogContext | null {
  let output: string;
  try {
    output = execFileSync("git", ["log", `-${MAX_COMMITS}`, "--pretty=%s"], {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    if (verbose) {
      const reason = e instanceof Error ? e.message : String(e);
      process.stderr.write(`[git-log] 커밋 히스토리를 수집할 수 없습니다: ${reason}\n`);
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/git-log.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/git-log.ts tests/git-log.test.ts
git commit -m "feat: git log 수집 및 비 git 디렉토리 graceful 처리"
```

---

### Task 3: 스코어링 모델 — 7번째 카테고리 가중치

**Files:**
- Modify: `src/types.ts:56-63` (`CATEGORY_WEIGHTS`)
- Test: `tests/scorer.test.ts` (테스트 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/scorer.test.ts`에 describe 추가 (기존 import에 `CATEGORY_WEIGHTS` 추가 필요 — `import { CATEGORY_WEIGHTS } from "../src/types.js";`):

```ts
describe("CATEGORY_WEIGHTS", () => {
  it("가중치 합계는 1.0이다", () => {
    const total = Object.values(CATEGORY_WEIGHTS).reduce((sum, w) => sum + w.weight, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it("이슈 트래킹 연동 카테고리가 nice 0.10으로 존재한다", () => {
    expect(CATEGORY_WEIGHTS["이슈 트래킹 연동"]).toEqual({ tier: "nice", weight: 0.10 });
  });

  it("must 카테고리는 3개이고 각 0.20이다", () => {
    const musts = Object.values(CATEGORY_WEIGHTS).filter((w) => w.tier === "must");
    expect(musts).toHaveLength(3);
    for (const m of musts) expect(m.weight).toBe(0.20);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/scorer.test.ts`
Expected: FAIL — "이슈 트래킹 연동" 카테고리 없음

- [ ] **Step 3: CATEGORY_WEIGHTS 수정**

`src/types.ts`의 `CATEGORY_WEIGHTS`를 다음으로 교체:

```ts
export const CATEGORY_WEIGHTS: Record<string, { tier: CategoryTier; weight: number }> = {
  "테스트 커버리지": { tier: "must", weight: 0.20 },
  "CI/CD": { tier: "must", weight: 0.20 },
  "훅 기반 검증": { tier: "must", weight: 0.20 },
  "리포지토리 구조": { tier: "nice", weight: 0.10 },
  "문서화 수준": { tier: "nice", weight: 0.10 },
  "하네스 엔지니어링": { tier: "nice", weight: 0.10 },
  "이슈 트래킹 연동": { tier: "nice", weight: 0.10 },
};
```

주의: `src/scorer.ts:56`의 폴백 `(cat.tier === "must" ? 0.20 : 0.133)`도 `0.10`으로 변경:

```ts
    const weight = config?.weight ?? (cat.tier === "must" ? 0.20 : 0.10);
```

- [ ] **Step 4: 전체 테스트 통과 확인**

Run: `npx vitest run`
Expected: PASS — 기존 scorer 테스트가 가중치 변경으로 깨지면 해당 테스트의 기대값을 새 가중치(nice 0.10) 기준으로 갱신한다.

- [ ] **Step 5: 커밋**

```bash
git add src/types.ts src/scorer.ts tests/scorer.test.ts
git commit -m "feat: 이슈 트래킹 연동 카테고리 가중치 추가 (nice 0.10 재분배)"
```

---

### Task 4: 프롬프트 확장 — 카테고리 정의 + Git Log Context 주입

**Files:**
- Modify: `src/prompts/analyze.ts`
- Test: `tests/analyze-prompt.test.ts` (테스트 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/analyze-prompt.test.ts`에 추가 (기존 import에 `GitLogContext` 타입 추가 — `import type { GitLogContext } from "../src/git-log.js";`):

```ts
describe("buildAnalysisPrompt — git log context", () => {
  const sampleContext: GitLogContext = {
    totalCommits: 100,
    issueRefRate: 45,
    refBreakdown: { github: 30, jira: 15, keywords: 10 },
    mergeCommitCount: 12,
    prWorkflowDetected: true,
    sampleSubjects: ["feat: add login (#12)", "PROJ-3 fix crash"],
  };

  it("gitLogContext가 있으면 통계와 샘플을 프롬프트에 포함한다", () => {
    const prompt = buildAnalysisPrompt(undefined, undefined, sampleContext);
    expect(prompt).toContain("Git Log Context");
    expect(prompt).toContain("45%");
    expect(prompt).toContain("feat: add login (#12)");
  });

  it("gitLogContext가 null이면 폴백 안내를 포함한다", () => {
    const prompt = buildAnalysisPrompt(undefined, undefined, null);
    expect(prompt).toContain("커밋 히스토리를 확인할 수 없");
  });

  it("이슈 트래킹 연동 카테고리가 ALL_CATEGORIES와 프롬프트에 포함된다", () => {
    expect(ALL_CATEGORIES).toContain("이슈 트래킹 연동");
    const prompt = buildAnalysisPrompt();
    expect(prompt).toContain("이슈 트래킹 연동");
    expect(prompt).toContain("7 categories");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/analyze-prompt.test.ts`
Expected: FAIL — 인자 3개 미지원, 카테고리 없음

- [ ] **Step 3: 프롬프트 구현**

`src/prompts/analyze.ts` 수정:

(a) `ALL_CATEGORIES`에 추가:

```ts
export const ALL_CATEGORIES = [
  "테스트 커버리지",
  "CI/CD",
  "훅 기반 검증",
  "리포지토리 구조",
  "문서화 수준",
  "하네스 엔지니어링",
  "이슈 트래킹 연동",
];
```

(b) import 추가:

```ts
import type { GitLogContext } from "../git-log.js";
```

(c) 시그니처 확장 및 git log 섹션 빌더 추가:

```ts
export function buildAnalysisPrompt(
  categories?: string[],
  customCategories?: CategoryConfig[],
  gitLogContext?: GitLogContext | null,
): string {
```

함수 본문 안에 (filterNote/customNote 계산 근처):

```ts
  const gitLogNote = buildGitLogNote(gitLogContext ?? null);
```

모듈 레벨에 함수 추가:

```ts
function buildGitLogNote(ctx: GitLogContext | null): string {
  if (!ctx) {
    return `\n\n## Git Log Context\n\n커밋 히스토리를 확인할 수 없습니다 (git 미설치 또는 git 리포지토리 아님). "이슈 트래킹 연동" 카테고리는 커밋 신호 없이 템플릿/설정 신호만으로 평가하세요.\n`;
  }
  return `\n\n## Git Log Context (pre-extracted, read-only)

다음은 분석 대상 리포지토리의 최근 ${ctx.totalCommits}개 커밋에서 사전 추출한 결정적 통계입니다. "이슈 트래킹 연동" 카테고리 평가의 1차 근거로 사용하세요.

- 이슈 참조율: ${ctx.issueRefRate}% (GitHub 참조 ${ctx.refBreakdown.github}건, Jira 참조 ${ctx.refBreakdown.jira}건, closes/fixes/resolves 키워드 ${ctx.refBreakdown.keywords}건)
- 머지 커밋: ${ctx.mergeCommitCount}건
- PR 워크플로 감지: ${ctx.prWorkflowDetected ? "예" : "아니오"}

최근 커밋 제목 샘플 (최대 50개) — 위 통계가 놓친 비표준 트래커(Linear, Asana 등) 참조 패턴이 보이면 평가에 보정 반영하세요:

${ctx.sampleSubjects.map((s) => `- ${s}`).join("\n")}
`;
}
```

(d) 카테고리 7번 섹션 — 하네스 엔지니어링 Scoring 블록 뒤, `## Output Requirements` 앞에 추가:

```
7. **이슈 트래킹 연동** (tier: "nice")
   커밋과 이슈 트래커(GitHub Issues, Jira 등)의 연동 수준 = 작업 추적성. AI 에이전트가 변경 의도를 파악하는 데 중요.
   Check for:
   - 커밋 메시지 이슈 참조율: Git Log Context 섹션의 통계를 1차 근거로 사용 (샘플에서 비표준 트래커 참조 발견 시 보정)
   - PR 기반 워크플로: Git Log Context의 머지/squash 통계 기반
   - 이슈/PR 템플릿: .github/ISSUE_TEMPLATE/, .github/PULL_REQUEST_TEMPLATE.md (Glob으로 확인)
   - 강제 장치: commitlint 이슈 참조 규칙, GitHub Actions 이슈 자동화 워크플로, Jira 설정 파일 (Grep/Read로 확인)
   - Scoring:
   - 0 = 이슈 연동 흔적 없음
   - 20 = 템플릿만 존재, 커밋 참조 없음
   - 40 = 커밋 이슈 참조율 낮음(<30%) 또는 PR 워크플로만 존재
   - 60 = 참조율 보통(30~60%) + PR 워크플로
   - 80 = 참조율 높음(60% 이상) + PR 워크플로 + 템플릿
   - 100 = 참조율 높음 + 템플릿 + 강제 장치(commitlint 규칙, 자동화 워크플로 등)
```

(e) 본문 갱신:
- `Score each of the following 6 categories` → `Score each of the following 7 categories`
- 출력 예시 JSON 직전 안내문은 변경 불필요 (카테고리 이름 나열 방식 유지)
- 최종 리턴 문자열 끝: `...${customNote}` → `...${gitLogNote}${customNote}`

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run`
Expected: PASS — 기존 프롬프트 테스트 중 "6 categories" 문자열을 검증하는 테스트가 있으면 "7 categories"로 갱신

- [ ] **Step 5: 커밋**

```bash
git add src/prompts/analyze.ts tests/analyze-prompt.test.ts
git commit -m "feat: 프롬프트에 이슈 트래킹 연동 카테고리 및 Git Log Context 주입"
```

---

### Task 5: analyzer/index 배선 — gitLogContext 전달

**Files:**
- Modify: `src/analyzer.ts:10-17` (`AnalyzerOptions`), `src/analyzer.ts:40` (`buildAnalysisPrompt` 호출)
- Modify: `src/index.ts` (단일/멀티 브랜치 흐름)

- [ ] **Step 1: analyzer.ts 수정**

import 추가:

```ts
import type { GitLogContext } from "./git-log.js";
```

`AnalyzerOptions`에 필드 추가:

```ts
export interface AnalyzerOptions {
  maxTurns?: number;
  maxBudgetUsd?: number;
  timeoutMs?: number;
  verbose?: boolean;
  categories?: string[];
  customCategories?: CategoryConfig[];
  gitLogContext?: GitLogContext | null;
}
```

구조 분해(`const { ... } = options;`)에 `gitLogContext` 추가하고, 프롬프트 빌드 호출 변경:

```ts
    const prompt = buildAnalysisPrompt(categories, customCategories, gitLogContext);
```

- [ ] **Step 2: index.ts 수정**

import 추가:

```ts
import { collectGitLogContext } from "./git-log.js";
```

`handleSingleBranch`에서 `analyzeRepository` 호출 직전(`llmOutput` 캐시 미스 분기 안)에 수집해 전달:

```ts
  } else {
    const gitLogContext = collectGitLogContext(repoPath, verbose);
    llmOutput = await analyzeRepository(repoPath, { ...analyzerOpts, gitLogContext });
    if (useCache) setCachedResult(repoPath, llmOutput);
  }
```

`handleMultiBranch`의 브랜치 루프 안 동일 분기도 같은 패턴으로 변경 (체크아웃 후 수집하므로 브랜치별 로그가 반영됨):

```ts
      } else {
        const gitLogContext = collectGitLogContext(repoPath, verbose);
        llmOutput = await analyzeRepository(repoPath, { ...analyzerOpts, gitLogContext });
        if (useCache) setCachedResult(repoPath, llmOutput);
      }
```

- [ ] **Step 3: 빌드 및 전체 테스트 확인**

Run: `npm run build && npx vitest run`
Expected: 빌드 성공, 전체 테스트 PASS

- [ ] **Step 4: 스모크 테스트 (프롬프트 주입 확인)**

Run: `npx tsx -e "const { collectGitLogContext } = await import('./src/git-log.js'); const { buildAnalysisPrompt } = await import('./src/prompts/analyze.js'); const ctx = collectGitLogContext('.'); console.log(buildAnalysisPrompt(undefined, undefined, ctx).includes('Git Log Context') ? 'OK' : 'FAIL');"`
Expected: `OK`

- [ ] **Step 5: 커밋**

```bash
git add src/analyzer.ts src/index.ts
git commit -m "feat: 분석 파이프라인에 git log 컨텍스트 배선"
```

---

### Task 6: 문서 갱신

**Files:**
- Modify: `CLAUDE.md` (Architecture, Data Flow, Analysis Categories 표)
- Modify: `README.md` (분석 카테고리 표)

- [ ] **Step 1: CLAUDE.md 갱신**

- Architecture의 `src/` 트리에 `git-log.ts # 커밋 로그 수집 + 이슈 참조 통계 (LLM 호출 전 사전 추출)` 추가
- Data Flow를 다음으로 교체:

```
CLI args → index.ts → git-log.ts (커밋 로그 사전 추출)
  → analyzer.ts (Claude SDK query + Git Log Context 주입) → LLMAnalysisOutput
  → scorer.ts (computeResult) → AnalysisResult
  → reporter.ts (printReport) → terminal output
```

- Analysis Categories 표를 7행으로 갱신 (nice 4개 각 0.10):

```markdown
| Category | Tier | Weight |
|----------|------|--------|
| Test Coverage | must | 0.20 |
| CI/CD | must | 0.20 |
| Hook-based Validation | must | 0.20 |
| Repository Structure | nice | 0.10 |
| Documentation Level | nice | 0.10 |
| Vibe Coding Config | nice | 0.10 |
| Issue Tracking Integration | nice | 0.10 |
```

- [ ] **Step 2: README.md 갱신**

README의 분석 카테고리 표/설명에 "이슈 트래킹 연동 (nice, 0.10)" 행 추가, 기존 nice 가중치를 0.10으로 갱신. SVG 시각화가 6카테고리 기준이면 텍스트 표만 갱신하고 SVG는 별도 이슈로 남긴다 (이 계획 범위 외).

- [ ] **Step 3: 전체 검증**

Run: `npm run build && npx vitest run`
Expected: 빌드 성공, 전체 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add CLAUDE.md README.md
git commit -m "docs: 이슈 트래킹 연동 카테고리 문서 반영 (7카테고리, nice 0.10)"
```

---

## 검증 체크리스트 (전체 완료 후)

- [ ] `npx vitest run` 전체 통과
- [ ] `npm run build` 성공
- [ ] `npx tsx src/index.ts . -v` 실행 시 7개 카테고리 결과 출력 (실제 LLM 호출 — 구독 인증 필요)
- [ ] 비 git 디렉토리에서 실행 시 에러 없이 분석 진행
