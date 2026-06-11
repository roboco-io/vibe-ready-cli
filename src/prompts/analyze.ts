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

export function buildAnalysisPrompt(
  categories?: string[],
  customCategories?: CategoryConfig[],
  gitLogContext?: GitLogContext | null,
): string {
  const filterNote = categories && categories.length > 0
    ? `\n\n**IMPORTANT: Only analyze the following categories: ${categories.join(", ")}. Skip all other categories.**\n`
    : "";

  const customNote = customCategories && customCategories.length > 0
    ? buildCustomCategoriesNote(customCategories)
    : "";

  const gitLogNote = buildGitLogNote(gitLogContext ?? null);

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

  return `You are a Vibe Coding Readiness Analyst. Your job is to analyze a repository and score how ready it is for AI-assisted "vibe coding" (using AI coding agents like Claude Code, Cursor, GitHub Copilot, etc.).${filterNote}

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
   - 20 = test framework configured but no/trivial test files
   - 40 = test files exist but minimal (few tests, no coverage config)
   - 60 = moderate test setup (reasonable test files + test scripts)
   - 80 = good test coverage setup (test scripts + coverage config)
   - 100 = comprehensive with coverage thresholds enforced

2. **CI/CD** (tier: "must")
   Check for:
   - Pipeline configuration files (.github/workflows/*.yml, .gitlab-ci.yml, Jenkinsfile, .circleci/, bitbucket-pipelines.yml, etc.)
   - Pipeline content quality: does it run tests? lint? build? deploy?
   - Multiple environments (dev, staging, prod)
   - Scoring:
   - 0 = no CI/CD
   - 20 = CI config file exists but minimal (e.g., only build step)
   - 40 = basic pipeline that runs tests
   - 60 = pipeline runs tests + lint or build
   - 80 = runs tests + lint + build
   - 100 = comprehensive with multiple stages/environments

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
   - 20 = hook framework configured but no meaningful checks
   - 40 = basic single hook (lint only or AI agent PreCommit only)
   - 60 = lint + format hooks or equivalent AI agent validation
   - 80 = lint + test + format hooks (traditional or AI agent)
   - 100 = comprehensive with commit validation + multiple hook types

### Nice-to-Have (권장) Categories — These improve AI coding effectiveness:

4. **리포지토리 구조** (tier: "nice")
   Check for:
   - Clear directory organization (src/, lib/, components/, services/ separation)
   - Dependency management (package.json, requirements.txt, go.mod, Cargo.toml)
   - Configuration separation (config files, environment files, .env.example)
   - Monorepo structure if applicable (workspace config, lerna, turborepo, nx)
   - Scoring:
   - 0 = flat/chaotic structure
   - 20 = minimal organization (some directories but no clear pattern)
   - 40 = basic structure (src/ exists, dependency file present)
   - 60 = reasonable organization (clear src/test separation, config files)
   - 80 = well-organized (clear separation of concerns, config separation)
   - 100 = exemplary (monorepo/workspace config, .env.example, clean layering)

5. **문서화 수준** (tier: "nice")
   Check for:
   - README.md existence and quality (sections: description, setup, usage, API, contributing)
   - CONTRIBUTING.md
   - API documentation (Swagger/OpenAPI, JSDoc, docstrings, typedoc)
   - Architecture documentation (ADR, diagrams, design docs)
   - Scoring:
   - 0 = no documentation
   - 20 = README exists but minimal (title/description only)
   - 40 = basic README with setup instructions
   - 60 = good README (setup + usage + structure sections)
   - 80 = good README + API docs or CONTRIBUTING.md
   - 100 = comprehensive docs (README + API + architecture + contributing)

6. **하네스 엔지니어링** (tier: "nice")
   Harness Engineering = AI 에이전트가 코드베이스를 효과적으로 이해하고 안전하게 작업할 수 있도록 구성하는 것.
   Check for:

   **컨텍스트 제공 (에이전트가 프로젝트를 이해할 수 있는가?)**
   - CLAUDE.md: 프로젝트 개요, 기술 스택, 빌드 명령어, 아키텍처, 데이터 플로우, 코딩 컨벤션이 포함되어 있는가?
   - AGENTS.md: 에이전트 작업 가이드라인, 모듈 구조, 확장 포인트, 금지 사항이 있는가?
   - .cursor/rules/ 또는 .cursorrules: Cursor IDE용 규칙 파일
   - .github/copilot-instructions.md: GitHub Copilot 지침

   **에이전트 권한/안전 설정 (에이전트가 안전하게 작업할 수 있는가?)**
   - .claude/settings.json: 에이전트 권한 설정 (허용 도구, 차단 도구)
   - PreCommit 훅: 에이전트 커밋 전 자동 검증 (빌드+테스트)
   - 읽기 전용 도구 제한 설정

   **스킬/커맨드 확장 (에이전트가 프로젝트 특화 작업을 수행할 수 있는가?)**
   - .claude/skills/: 커스텀 스킬 정의
   - .claude/commands/: 커스텀 명령 정의
   - .codex/skills/: Codex용 스킬 정의
   - MCP 서버 설정

   **컨텍스트 품질 (문서가 에이전트 친화적으로 작성되었는가?)**
   - CLAUDE.md가 단순 설명이 아닌 에이전트가 즉시 활용 가능한 구조화된 정보를 포함하는가? (빌드 명령어, 아키텍처 다이어그램, 데이터 플로우)
   - 다중 AI 도구 지원 여부 (Claude + Cursor + Copilot 등)

   Scoring:
   - 0 = AI 에이전트 설정 전무
   - 20 = 기본 README만 존재 (에이전트 전용 문서 없음)
   - 40 = CLAUDE.md 또는 AGENTS.md 중 하나만 존재 (기본 수준)
   - 60 = CLAUDE.md + AGENTS.md 존재, 프로젝트 컨텍스트 포함
   - 80 = 컨텍스트 + 안전 설정 + 스킬/커맨드 중 일부 구성
   - 100 = 포괄적 하네스: 컨텍스트(CLAUDE.md+AGENTS.md) + 안전설정(settings.json+PreCommit) + 스킬/커맨드 + 다중 AI 도구 지원

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

## Output Requirements

For each category, provide:
- **name**: The exact Korean category name as listed above
- **tier**: "must" or "nice"
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

Include all categories in the exact names listed above. Output ONLY the JSON, nothing else.${gitLogNote}${customNote}`;
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

${ctx.sampleSubjects.map((s) => `- ${s}`).join("\n")}
`;
}
