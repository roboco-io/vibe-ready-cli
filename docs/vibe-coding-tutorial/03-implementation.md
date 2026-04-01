> 🇰🇷 [한국어 버전](03-implementation.ko.md)

# Chapter 3: MVP Implementation

> **Time required**: ~40 minutes
> **Key Insight**: Once requirements are clear from the deep interview, implementation can start with a single prompt line.

## Context

Through the deep interview in Chapter 2, we reduced ambiguity to 19%. Now we write actual code based on the confirmed spec. The core architectural decisions are already made:

- LLM-based analysis via Claude Agent SDK
- Weighted average scoring across 6 categories (3 required + 3 recommended)
- Terminal output (chalk formatting)
- TypeScript + ESM

## The Prompt

Since the deep interview results are saved in `.omc/specs/deep-interview-vibe-ready-cli.md`, the implementation request is simple:

```
Based on the deep interview results, implement the MVP
```

## What Happened

The AI read the deep interview spec and generated 5 modules in sequence.

### 1. Type Definitions (`src/types.ts`)

Data models are defined first. The ontology confirmed in the deep interview maps directly to types:

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

You can see how the "must vs. nice" classification confirmed in deep interview Round 5 maps directly to `CategoryTier`, and the grading system from Round 4 maps directly to `Grade`.

### 2. LLM Prompt (`src/prompts/analyze.ts`)

We write the analysis prompt to pass to the Claude Agent SDK. This prompt assigns the LLM the role of "repository analyst":

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

For each category, we specify "what to look for" and "scoring criteria." This is the core of LLM-based analysis — instead of coding rules, **judgment criteria are delivered in natural language**.

### 3. Analysis Engine (`src/analyzer.ts`)

The LLM is invoked using the Claude Agent SDK's `query()` function:

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
  // LLM explores the repo and performs analysis
}
```

**Key points**:
- `tools: ["Read", "Glob", "Grep"]` — only file reading/searching tools are allowed for the LLM
- `permissionMode: "dontAsk"` — runs automatically without user confirmation
- `outputFormat: json_schema` — forces LLM output into structured JSON

### 4. Scorer (`src/scorer.ts`)

Converts the LLM's raw output into a weighted average score + grade:

```typescript
export function computeResult(llmOutput: LLMAnalysisOutput): AnalysisResult {
  const categories = llmOutput.categories.map((cat) => ({
    ...cat,
    grade: gradeFromScore(cat.score),
  }));

  const totalScore = computeWeightedAverage(categories);
  let totalGrade = gradeFromScore(totalScore);

  // Penalty: required category F → overall grade capped at C
  const { penaltyApplied } = checkPenalty(categories);
  if (penaltyApplied && gradeRank(totalGrade) < gradeRank("C")) {
    totalGrade = "C";
  }

  return { categories, totalScore, totalGrade, ... };
}
```

The "required category F → overall grade capped at C" rule confirmed in the deep interview is implemented as-is.

### 5. Reporter (`src/reporter.ts`)

Terminal formatting using chalk:

```
═══════════════════════════════════════════════════
  🎵 Vibe Ready Score
═══════════════════════════════════════════════════

  Overall Score: 72 / 100  Grade: C
  ⚠ Required category graded F: Hook validation → overall grade capped at C

  Results by Category
  ─────────────────────────────────────────────────
  Test Coverage        Required     85       B
  CI/CD               Required     90       A
  Hook Validation     Required     45       F
  ...
```

### 6. CLI Entry Point (`src/index.ts`)

CLI interface configured with commander:

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

Running build and tests:

```bash
$ npm run build
# TypeScript compilation successful

$ npm test
# 12 tests passed
 ✓ scorer.test.ts (8 tests)
 ✓ types.test.ts (4 tests)
```

## Data Flow Summary

```
User: vibe-ready /path/to/repo
  → index.ts: CLI parsing
    → analyzer.ts: LLM invocation via Claude SDK
      → LLM explores repo via Read/Glob/Grep
      → Returns JSON with 6-category analysis results
    → scorer.ts: Weighted average + grade + penalty calculation
    → reporter.ts: Terminal report output via chalk
```

## Lessons Learned

1. **Deep interview → code mapping is direct**: The ontology confirmed in the interview (Entity, Category, Grade) became TypeScript types almost as-is. When requirements are clear, implementation is mechanical.

2. **LLM prompt is the business logic**: In traditional tools, you'd need to code per-language patterns as rules — in an LLM-based approach, **the natural language prompt is the rule**. A single prompt in `analyze.ts` covers all languages and frameworks.

3. **Force LLM output with JSON Schema**: Using `outputFormat: { type: "json_schema" }` makes the LLM return JSON matching the specified schema. You get structured data without worrying about parse failures.

4. **Pure functions can be tested without LLM**: Functions like `computeResult` and `gradeFromScore` in `scorer.ts` are pure functions independent of LLM, making unit testing straightforward. Separating LLM-dependent parts from pure logic is key.

## Try It Yourself

```bash
# After cloning the project
npm install
npm run build

# Analyze your own repository
node dist/index.js /path/to/your/repo --verbose

# Run tests
npm test
```

---

**Previous Chapter**: [02 - Clarifying Requirements with Deep Interview](02-deep-interview.md)
**Next Chapter**: [04 - Harness Engineering](04-harness-engineering.md)
