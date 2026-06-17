export const ALL_CATEGORIES = [
  "테스트 커버리지",
  "CI/CD",
  "훅 기반 검증",
  "리포지토리 구조",
  "문서화 수준",
  "하네스 엔지니어링",
  "이슈 트래킹 연동",
];

import type { CategoryConfig } from "../config.js";
import type { GitLogContext } from "../git-log.js";
import type { AgentId } from "../agents.js";
import { buildAgentFocusNote } from "../agents.js";

export function buildAnalysisPrompt(
  categories?: string[],
  customCategories?: CategoryConfig[],
  gitLogContext?: GitLogContext | null,
  agent?: AgentId | null,
): string {
  const filterNote = categories && categories.length > 0
    ? `\n\n**IMPORTANT: Only analyze the following categories: ${categories.join(", ")}. Skip all other categories.**\n`
    : "";

  const agentNote = agent ? buildAgentFocusNote(agent) : "";

  const customNote = customCategories && customCategories.length > 0
    ? buildCustomCategoriesNote(customCategories)
    : "";

  const gitLogNote = buildGitLogNote(gitLogContext ?? null);

  return `You are a Vibe Coding Readiness Analyst. Your job is to analyze a repository and score how ready it is for AI-assisted "vibe coding" (using AI coding agents like Claude Code, Cursor, GitHub Copilot, etc.).${filterNote}${agentNote}

## Instructions

Analyze the repository in the current working directory. Be efficient with your tool usage:
1. First, use Glob to get the top-level file listing and key directories
2. Then check for specific files relevant to each category (don't read every file)
3. Only Read files that are directly relevant (config files, not source code)

IMPORTANT: Be efficient. Do NOT read source code files. Focus on config files, README, and directory structure. Complete your analysis within 20 tool calls.

Score each of the following 7 categories from 0 to 100. Be precise and evidence-based.

## Categories

### Must-Have (필수) Categories — These are critical for safe AI-assisted development:

1. **테스트 커버리지** (tier: "must")
   Check for:
   - Test configuration files (jest.config, vitest.config, pytest.ini, setup.cfg, phpunit.xml, etc.)
   - Test directories and test files (test/, tests/, __tests__/, *.test.*, *.spec.*, *_test.*)
   - Coverage configuration (coverage settings in config files, .nycrc, coverageThreshold, etc.)
   - Test scripts in package.json, Makefile, or equivalent
   - Scoring:
   - 0 = no tests at all
   - 20 = test framework/config or test script exists, but zero test files or only placeholder/smoke test files are present
   - 40 = 1-2 test files or a test directory exists, but no coverage config and no evidence of broad module coverage
   - 60 = 3+ test files across multiple source areas + runnable test script, but no coverage collection/threshold config
   - 80 = runnable test script + coverage collection config/script, but coverage thresholds are not enforced
   - 100 = runnable test script + coverage collection + coverage thresholds enforced in config or CI

2. **CI/CD** (tier: "must")
   Check for:
   - Pipeline configuration files (.github/workflows/*.yml, .gitlab-ci.yml, Jenkinsfile, .circleci/, bitbucket-pipelines.yml, etc.)
   - Pipeline content quality: does it run tests? lint? build? deploy?
   - Multiple environments (dev, staging, prod)
   - Scoring:
   - 0 = no CI/CD
   - 20 = CI config exists and runs exactly one non-test quality step such as build, install, or formatting
   - 40 = basic pipeline that runs tests
   - 60 = pipeline runs tests + lint or build
   - 80 = runs tests + lint + build
   - 100 = tests + lint + build plus an appropriate gated release/deploy/publish workflow; multiple environments only required for deployable services

3. **훅 기반 검증** (tier: "must")
   Check for:
   - Git hooks setup (husky, .husky/, pre-commit config, lefthook, etc.)
   - Lint-staged or equivalent (lint-staged in package.json, .lintstagedrc)
   - Pre-commit hooks that run: linting, unit tests, type checking, formatting
   - Commit message validation (commitlint, conventional commits)
   - AI agent hooks (.claude/settings.json or .claude/settings.local.json with PreCommit/PrePush hooks, Cursor pre-commit rules)
   - AI coding agent commit validation (e.g., Claude Code PreCommit that runs build+test before commit)
   - Scoring:
   - 0 = no hooks
   - 20 = hook framework configured, but hooks are empty, disabled, echo-only, or do not run lint/test/type/format/commit-message checks
   - 40 = exactly one hook type runs one concrete check such as lint, format, typecheck, test, or commit-message validation
   - 60 = hooks run at least two concrete pre-commit checks, e.g. lint + format, or an AI-agent hook explicitly running equivalent named commands
   - 80 = hooks run lint + test + format, and optionally typecheck, via traditional hooks or explicit AI-agent hook commands
   - 100 = pre-commit/pre-push quality hooks plus commit-message validation, with at least two hook events or stages configured

### Nice-to-Have (권장) Categories — These improve AI coding effectiveness:

4. **리포지토리 구조** (tier: "nice")
   Check for:
   - Clear directory organization (src/, lib/, components/, services/ separation)
   - Dependency management (package.json, requirements.txt, go.mod, Cargo.toml)
   - Configuration separation (config files, environment files, .env.example)
   - Monorepo structure if applicable (workspace config, lerna, turborepo, nx)
   - Scoring:
   - 0 = no clear source directory, dependency manifest, or separated config/test/doc directories
   - 20 = 2+ top-level directories exist, but source, tests, config, and docs are not consistently separated
   - 40 = basic structure (src/ exists, dependency file present)
   - 60 = source and test/config areas are separated, and dependency manifest is present
   - 80 = source, tests, config, and docs are separated with recognizable responsibility-based directories
   - 100 = project-appropriate structure with dependency manifest, config separation, environment example when env vars are used, and clear responsibility-based source directories; workspace config only when monorepo

5. **문서화 수준** (tier: "nice")
   Check for:
   - README.md existence and quality (sections: description, setup, usage, API)
   - API documentation (Swagger/OpenAPI, JSDoc, docstrings, typedoc)
   - Architecture documentation (ADR, diagrams, design docs)
   - CONTRIBUTING.md (선택 사항 — 필수 아님, 있으면 소폭 가산되는 타이브레이커일 뿐)
   - Scoring:
   - 0 = no documentation
   - 20 = README exists but minimal (title/description only)
   - 40 = basic README with setup instructions
   - 60 = README includes setup, usage, and repository structure sections
   - 80 = README includes setup, usage, and structure sections + API/CLI/configuration reference appropriate to the project type
   - 100 = README + project-appropriate API/CLI/configuration reference + architecture/design documentation
   - CONTRIBUTING.md은 만점 요건이 아닙니다. 부재해도 위 기준을 충족하면 만점이며, 존재 시에만 동점 상황에서 소폭 가산하세요.

6. **하네스 엔지니어링** (tier: "nice")
   Harness Engineering = AI 에이전트가 코드베이스를 효과적으로 이해하고 안전하게 작업할 수 있도록 구성하는 것.

   **CRITICAL — 단일 에이전트 기준 평가:**
   여러 AI 에이전트(Claude Code, Codex, Cursor, Copilot 등)를 모두 지원할 필요는 없습니다.
   프로젝트가 채택한 **하나의 에이전트**에 대해 컨텍스트·안전·확장 설정이 충실하면 만점입니다.
   먼저 레포에 실제로 구성된 에이전트(.claude/, AGENTS.md, .cursor/·.cursorrules, .github/copilot-instructions.md 등의 존재)를 식별하세요.
   각 에이전트 생태계를 따로 평가하고, **가장 잘 갖춰진 단일 에이전트의 완성도**를 점수의 기준으로 삼으세요.
   구성되지 않은 에이전트의 부재는 감점 사유가 아닙니다.
   단일 에이전트가 완비되었다면 그것만으로 이미 만점입니다. 한 도구만 갖춘 것은 감점 사유가 아닙니다.
   여러 에이전트를 동시에 지원하는 것은 점수 기준이 아니라 **소폭 가산(타이브레이커)** 요소일 뿐입니다.
   (예: CLAUDE.md + .claude/settings.json + .claude/skills/·agents/ 가 완비되었다면
   AGENTS.md·.cursorrules·copilot-instructions.md 가 없어도 100점입니다.)

   에이전트별 신호 (이 중 하나의 에이전트만 충족해도 됨):
   - **Claude Code**: CLAUDE.md(컨텍스트) + .claude/settings.json(권한/안전) + .claude/{skills,agents}/(확장) + PreCommit 훅
   - **Codex**: AGENTS.md(컨텍스트) + .codex/ 설정 + .codex/skills/(확장)
   - **Cursor**: .cursor/rules/ 또는 .cursorrules(컨텍스트/규칙)
   - **GitHub Copilot**: .github/copilot-instructions.md(컨텍스트)

   선택한 단일 에이전트 안에서 다음 3개 축을 평가:
   **① 컨텍스트 제공** — 가이드 문서가 단순 설명이 아닌, 에이전트가 즉시 활용 가능한 구조화된 정보(프로젝트 개요, 기술 스택, 빌드 명령어, 아키텍처/데이터 플로우, 코딩 컨벤션)를 담는가?
   **② 안전 설정** — 권한/도구 제한(settings.json 등) + PreCommit 등 커밋 전 자동 검증(빌드+테스트) 훅이 있는가?
   **③ 확장** — 스킬/에이전트/MCP 서버 등 프로젝트 특화 확장이 있는가? (커맨드는 최근 스킬로 대체되는 추세이므로 확장 신호로 보지 않음)

   Scoring (가장 잘 갖춰진 단일 에이전트 기준):
   - 0 = AI 에이전트 설정 전무
   - 20 = 기본 README만 존재 (에이전트 전용 문서 없음)
   - 40 = 에이전트 전용 가이드 문서는 있으나 프로젝트 개요·기술 스택·빌드/테스트 명령어·아키텍처/데이터 플로우·코딩 컨벤션 중 2개 이하만 포함
   - 60 = 단일 에이전트 컨텍스트 문서가 위 5개 항목 중 3개 이상 포함 (①)
   - 80 = 60점 수준의 컨텍스트 + 권한/도구 제한 또는 PreCommit 설정(②), 또는 프로젝트 특화 스킬/에이전트/MCP 중 하나(③) (① + ② 또는 ③)
   - 100 = 60점 수준의 컨텍스트 + 권한/도구 제한 또는 PreCommit 설정(②) + 프로젝트 특화 스킬/에이전트/MCP 중 하나(③) (① + ② + ③)
   - 가산점(타이브레이커): 위 기준으로 단일 에이전트 점수를 정한 뒤, 다른 에이전트 생태계도 추가 지원하면 동급 내에서 소폭 가산(상한 100). 단일 에이전트가 이미 완비(100)면 추가 가산 없음.

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
   - 40 = 커밋 이슈 참조율 낮음(<30%), 또는 Git Log Context에서 PR 머지/squash 패턴이 감지되거나 PR 템플릿/브랜치 보호 워크플로가 존재
   - 60 = 참조율 보통(30~60%) + PR 워크플로
   - 80 = 참조율 높음(60% 이상) + PR 워크플로 + 템플릿
   - 100 = 참조율 높음(60% 이상) + 템플릿 + 강제 장치(commitlint 규칙, 자동화 워크플로 등)${gitLogNote}
## Output Requirements

For each category, provide:
- **name**: The exact Korean category name as listed above
- **tier**: "must", "nice", or "optional" (optional 카테고리는 등급에 영향을 주지 않고 가산점으로만 반영되지만, 평가/점수 산정은 동일하게 수행)
- **score**: 0-100 integer based on evidence found
- **recommendations**: Array of actionable recommendations (severity: critical/warning/info)
- **rawFindings**: Array of specific items checked (item name, found: boolean, details)

Also provide a **summary**: A concise 2-3 sentence overall assessment in Korean.

Be thorough but honest. If something doesn't exist, score it low. Base all scores on actual evidence found in the repository.

## CRITICAL: Output Format

After completing your analysis, output ONLY a valid JSON object (no markdown, no code fences) matching this exact structure:

{
  "categories": [
    {
      "name": "테스트 커버리지",
      "tier": "must",
      "score": 75,
      "recommendations": [{"severity": "warning", "message": "...", "action": "..."}],
      "rawFindings": [{"item": "jest.config.js", "found": true, "details": "..."}]
    }
  ],
  "summary": "한국어로 된 2-3문장 요약"
}

Include all categories in the exact names listed above. Output ONLY the JSON, nothing else.${customNote}`;
}

function buildCustomCategoriesNote(cats: CategoryConfig[]): string {
  const lines = ["\n\n## Custom Categories (from config file)\n\nThe following categories are defined by the project's config file. Evaluate them IN ADDITION TO or INSTEAD OF the default categories above, based on whether they replace or extend defaults.\n"];
  for (const cat of cats) {
    if (!ALL_CATEGORIES.includes(cat.name)) {
      lines.push(`### ${cat.name} (tier: "${cat.tier}")`);
      if (cat.description) lines.push(`   ${cat.description}`);
      if (cat.checkpoints && cat.checkpoints.length > 0) {
        lines.push("   Check for:");
        for (const cp of cat.checkpoints) {
          lines.push(`   - ${cp}`);
        }
      }
      lines.push("");
    }
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

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

${ctx.sampleSubjects.map((s) => `- ${s.replace(/[\r\n]+/g, " ")}`).join("\n")}
`;
}
