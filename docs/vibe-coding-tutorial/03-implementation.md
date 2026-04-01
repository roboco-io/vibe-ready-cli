# Chapter 3: MVP 구현

> **소요 시간**: ~40분
> **Key Insight**: 심층 인터뷰로 요구사항이 명확해지면, 구현은 프롬프트 한 줄로 시작할 수 있다.

## Context

Chapter 2의 심층 인터뷰를 통해 모호도를 19%까지 낮췄습니다. 이제 확정된 스펙을 기반으로 실제 코드를 작성합니다. 핵심 아키텍처 결정은 이미 내려져 있습니다:

- Claude Agent SDK로 LLM 기반 분석
- 6개 카테고리 (필수 3 + 권장 3) 가중 평균 스코어링
- 터미널 출력 (chalk 포맷팅)
- TypeScript + ESM

## The Prompt

심층 인터뷰 결과가 `.omc/specs/deep-interview-vibe-ready-cli.md`에 저장되어 있으므로, 구현 요청은 간단합니다:

```
심층 인터뷰 결과를 기반으로 MVP를 구현해줘
```

## What Happened

AI가 심층 인터뷰 스펙을 읽고, 5개 모듈을 순서대로 생성했습니다.

### 1. 타입 정의 (`src/types.ts`)

가장 먼저 데이터 모델을 정의합니다. 심층 인터뷰에서 확정된 온톨로지가 그대로 타입이 됩니다:

```typescript
export type Grade = "A" | "B" | "C" | "D" | "F";
export type CategoryTier = "must" | "nice";

export interface CategoryResult {
  name: string;
  tier: CategoryTier;
  score: number;        // 0~100
  grade: Grade;
  recommendations: Recommendation[];
  rawFindings: RawFinding[];
}

export const CATEGORY_WEIGHTS: Record<string, { tier: CategoryTier; weight: number }> = {
  "테스트 커버리지": { tier: "must", weight: 0.20 },
  "CI/CD":          { tier: "must", weight: 0.20 },
  "훅 기반 검증":    { tier: "must", weight: 0.20 },
  "리포지토리 구조":  { tier: "nice", weight: 0.133 },
  "문서화 수준":     { tier: "nice", weight: 0.133 },
  "바이브 코딩 설정": { tier: "nice", weight: 0.134 },
};
```

심층 인터뷰 Round 5에서 확정된 "필수 vs 권장" 분류가 `CategoryTier`로, Round 4에서 나온 등급 시스템이 `Grade`로 직접 매핑된 것을 볼 수 있습니다.

### 2. LLM 프롬프트 (`src/prompts/analyze.ts`)

Claude Agent SDK에 전달할 분석 프롬프트를 작성합니다. 이 프롬프트가 LLM에게 "리포지토리 분석가" 역할을 부여합니다:

```typescript
export function buildAnalysisPrompt(): string {
  return `You are a Vibe Coding Readiness Analyst.
Your job is to analyze a repository and score how ready it is
for AI-assisted "vibe coding"...

## Categories

### Must-Have (필수) Categories:

1. **테스트 커버리지** (tier: "must")
   Check for:
   - Test configuration files (jest.config, vitest.config, ...)
   - Test directories and test files
   - Coverage configuration
   ...`;
}
```

각 카테고리마다 "무엇을 찾아야 하는지"와 "점수 기준"을 명시합니다. 이것이 LLM 기반 분석의 핵심 — 규칙을 코드로 짜는 대신, **자연어로 판단 기준을 전달**합니다.

### 3. 분석 엔진 (`src/analyzer.ts`)

Claude Agent SDK의 `query()` 함수로 LLM을 호출합니다:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt,
  options: {
    cwd: repoPath,
    tools: ["Read", "Glob", "Grep"],
    allowedTools: ["Read", "Glob", "Grep"],
    permissionMode: "dontAsk",
    maxTurns: 20,
    outputFormat: {
      type: "json_schema",
      schema: ANALYSIS_JSON_SCHEMA,
    },
  },
})) {
  // LLM이 리포를 탐색하며 분석 수행
}
```

**핵심 포인트**:
- `tools: ["Read", "Glob", "Grep"]` — LLM에게 파일 읽기/검색 도구만 허용
- `permissionMode: "dontAsk"` — 사용자 확인 없이 자동 실행
- `outputFormat: json_schema` — LLM 출력을 구조화된 JSON으로 강제

### 4. 스코어러 (`src/scorer.ts`)

LLM의 raw 출력을 가중 평균 점수 + 등급으로 변환합니다:

```typescript
export function computeResult(llmOutput: LLMAnalysisOutput): AnalysisResult {
  const categories = llmOutput.categories.map((cat) => ({
    ...cat,
    grade: gradeFromScore(cat.score),
  }));

  const totalScore = computeWeightedAverage(categories);
  let totalGrade = gradeFromScore(totalScore);

  // 페널티: 필수 카테고리 F → 전체 등급 최대 C
  const { penaltyApplied } = checkPenalty(categories);
  if (penaltyApplied && gradeRank(totalGrade) < gradeRank("C")) {
    totalGrade = "C";
  }

  return { categories, totalScore, totalGrade, ... };
}
```

심층 인터뷰에서 확정된 "필수 카테고리 F → 전체 C 캡핑" 규칙이 그대로 구현되었습니다.

### 5. 리포터 (`src/reporter.ts`)

chalk를 사용한 터미널 포맷팅:

```
═══════════════════════════════════════════════════
  🎵 Vibe Ready Score
═══════════════════════════════════════════════════

  종합 점수: 72 / 100  등급: C
  ⚠ 필수 카테고리 F 등급: 훅 기반 검증 → 전체 등급 최대 C로 제한

  카테고리별 결과
  ─────────────────────────────────────────────────
  테스트 커버리지       필수     85       B
  CI/CD               필수     90       A
  훅 기반 검증         필수     45       F
  ...
```

### 6. CLI 엔트리포인트 (`src/index.ts`)

commander로 CLI 인터페이스를 구성합니다:

```typescript
program
  .name("vibe-ready")
  .argument("[path]", "Path to the repository to analyze", ".")
  .option("-v, --verbose", "Show detailed analysis findings")
  .option("--max-turns <number>", "Max LLM agent turns", "20")
  .option("--max-budget <number>", "Max budget in USD", "0.50")
  .option("--timeout <number>", "Timeout in seconds", "120")
```

## The Result

빌드와 테스트를 실행합니다:

```bash
$ npm run build
# TypeScript 컴파일 성공

$ npm test
# 12 tests passed
 ✓ scorer.test.ts (8 tests)
 ✓ types.test.ts (4 tests)
```

## 데이터 플로우 요약

```
사용자: vibe-ready /path/to/repo
  → index.ts: CLI 파싱
    → analyzer.ts: Claude SDK로 LLM 호출
      → LLM이 Read/Glob/Grep으로 리포 탐색
      → 6개 카테고리 분석 결과 JSON 반환
    → scorer.ts: 가중 평균 + 등급 + 페널티 계산
    → reporter.ts: chalk로 터미널 리포트 출력
```

## Lessons Learned

1. **심층 인터뷰 → 코드 매핑이 직접적이다**: 인터뷰에서 확정된 온톨로지(Entity, Category, Grade)가 거의 그대로 TypeScript 타입이 되었다. 요구사항이 명확하면 구현은 기계적이다.

2. **LLM 프롬프트가 곧 비즈니스 로직이다**: 전통적 도구에서는 각 언어별 패턴을 규칙으로 코딩해야 하지만, LLM 기반에서는 **자연어 프롬프트가 규칙**이다. `analyze.ts`의 프롬프트 하나로 모든 언어/프레임워크를 커버한다.

3. **JSON Schema로 LLM 출력을 강제하라**: `outputFormat: { type: "json_schema" }`를 사용하면 LLM이 지정된 스키마에 맞는 JSON을 반환한다. 파싱 실패 걱정 없이 구조화된 데이터를 받을 수 있다.

4. **순수 함수는 LLM 없이 테스트 가능하다**: `scorer.ts`의 `computeResult`, `gradeFromScore` 등은 LLM과 무관한 순수 함수라 단위 테스트가 쉽다. LLM 의존 부분과 순수 로직을 분리하는 것이 핵심.

## Try It Yourself

```bash
# 프로젝트 클론 후
npm install
npm run build

# 자신의 리포지토리 분석해보기
node dist/index.js /path/to/your/repo --verbose

# 테스트 실행
npm test
```

---

**이전 챕터**: [02 - 심층 인터뷰로 요구사항 구체화](02-deep-interview.md)
**다음 챕터**: [04 - 하네스 엔지니어링](04-harness-engineering.md)
