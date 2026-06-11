# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**vibe-ready-cli** is a CLI tool that analyzes how ready a repository is for vibe coding (AI agent-based development). It uses the Claude Agent SDK to analyze repositories via LLM, outputting a score (0–100) and grade (A–F) per 7 categories, along with improvement recommendations, to the terminal.

## Tech Stack

- **Runtime**: Node.js >= 24, TypeScript (ES2022, ESM)
- **Analysis Engine**: `@anthropic-ai/claude-agent-sdk` — LLM-based repo analysis
- **CLI**: `commander` (argument parsing), `chalk` (terminal formatting)
- **Testing**: `vitest`
- **Build**: `tsc` (TypeScript compiler)

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript → dist/
npm test             # Run vitest unit tests
npm run test:watch   # vitest watch mode
```

### Running

```bash
# Run directly during development
npx tsx src/index.ts [path] [-v] [--max-turns 20] [--max-budget 0.50] [--timeout 120]

# Run after build
node dist/index.js [path]

# After publishing
npx vibe-ready [path]
```

**Authentication**: Uses Claude Code subscription auth as-is (no separate API key required)

## Architecture

```
src/
  index.ts           # CLI entrypoint (commander-based)
  analyzer.ts        # Repo analysis via Claude Agent SDK (query → LLM call)
  git-log.ts         # 커밋 로그 수집 + 이슈 참조 통계, LLM 호출 전 사전 추출
  scorer.ts          # LLM output → weighted average score + grade + penalty calculation
  reporter.ts        # Terminal report output (chalk formatting)
  types.ts           # Type definitions, scoring model, JSON schema
  prompts/
    analyze.ts       # LLM analysis prompt builder
```

### Data Flow

```
CLI args → index.ts → git-log.ts (커밋 로그 사전 추출)
  → analyzer.ts (Claude SDK query + Git Log Context 주입) → LLMAnalysisOutput
  → scorer.ts (computeResult) → AnalysisResult
  → reporter.ts (printReport) → terminal output
```

### Analysis Categories (7)

| Category | Tier | Weight |
|----------|------|--------|
| Test Coverage | must | 0.20 |
| CI/CD | must | 0.20 |
| Hook-based Validation | must | 0.20 |
| Repository Structure | nice | 0.10 |
| Documentation Level | nice | 0.10 |
| Harness Engineering | nice | 0.10 |
| Issue Tracking Integration | nice | 0.10 |

### Scoring Rules

- Each category: 0–100 points, grade A(90+)/B(80+)/C(70+)/D(50+)/F(<50)
- Overall: weighted average (out of 100)
- **Penalty**: Any required category with grade F → overall grade capped at C

## Coding Conventions

- **File names**: responsibility-based kebab-case (`docs-check.ts`, `ci-check.ts`)
- **Indentation**: 2 spaces (TS, JSON, YAML, MD)
- **Modules**: ESM (`"type": "module"`, `.js` extension required in imports)
- **Check modules**: Single responsibility principle — one file per check
- **Output**: Deterministic, concise, diff-friendly
- **Error messages**: Korean

## Testing Guidelines

- Test directory: `tests/` (mirroring source structure)
- Naming: `*.test.ts` or `*.spec.ts`
- Framework: vitest
- Cover both pass/fail cases (especially missing-docs, missing-CI, weak-hook scenarios)
- Fixture repos: sample repository configurations under `tests/fixtures/`

## Key Constraints

- MVP scope: single repo analysis + terminal output only
- Language agnostic: LLM makes the judgment (not pattern matching)
- Read-only: does not modify the target repository
- SDK tools: only `Read`, `Glob`, `Grep` allowed (`permissionMode: "dontAsk"`)

## Status

MVP implementation complete. CLI + analysis engine + scorer + reporter + unit tests (vitest, all passing). Build successful.
