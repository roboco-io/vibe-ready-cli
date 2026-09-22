# Repository Guidelines

This file is the single source of agent instructions for this repository. Codex reads it directly; Claude Code loads it through the `@AGENTS.md` import in `CLAUDE.md`.

## Project Overview

**vibe-ready-cli** analyzes repository readiness and development processes using either Claude Agent SDK (default) or Codex CLI (`--engine codex`). Scoring reports 7 categories; `--diagnose` provides evidence-based improvement advice and team interviews.

- **Runtime**: Node.js >= 24, TypeScript (ES2022, ESM)
- **Analysis engines**: `@anthropic-ai/claude-agent-sdk` (default) or Codex CLI — LLM-based repo analysis
- **CLI**: `commander` (argument parsing), `chalk` (terminal formatting)
- **Testing**: `vitest`
- **Build**: `tsc`

## Project Structure & Module Organization

```
src/
  index.ts           # CLI entrypoint (commander)
  analyzer.ts        # Scoring analysis via the selected engine
  engines/           # Engine dispatcher: Claude Agent SDK / isolated read-only Codex CLI
  agents.ts          # Coding-agent definitions for harness evaluation (--agent)
  git-log.ts         # Commit log + issue-reference stats, pre-extracted before the LLM call
  cache.ts           # Analysis result cache (keyed by engine)
  config.ts          # .vibeready.json config loading
  scorer.ts          # Weighted average scoring + penalty logic
  reporter.ts        # Terminal report output (chalk)
  types.ts           # Types, scoring model, JSON schema
  diagnosis/         # Read-only PR/CI collectors, practical rubric, agent/interview, snapshots
  prompts/
    analyze.ts       # LLM analysis prompts
tests/
  fixtures/          # Sample repositories (pass/fail scenarios)
docs/
  ideation.md        # Initial planning document
```

Keep modules single-responsibility: add a new focused file rather than growing a general-purpose analyzer. Do not edit or commit `.omc/` or `.omx/` — these are local tool state.

## Build, Test, and Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile tsc → dist/
npm test             # vitest run (unit/integration tests)
npm run test:watch   # vitest watch mode
```

Run:

```bash
npx tsx src/index.ts [path] [-v] [--max-turns 20] [--max-budget 0.50] [--timeout 120]   # development
node dist/index.js [path]                                                              # after build
npx vibe-ready [path]                                                                  # after publishing
```

Authentication: Uses the selected engine's existing Claude Code or Codex login. `--engine claude|codex` is independent from harness focus (`--agent`) and forge selection (`--provider`).

Command names must not be changed once published.

## Coding Style & Naming Conventions

- 2-space indentation (TS, JSON, YAML, MD)
- ESM modules (`"type": "module"`, `.js` extension required on imports)
- File names are responsibility-based kebab-case: `docs-check.ts`, `ci-check.ts`, `hooks-check.ts`
- Check modules have single responsibility — prefer small, focused checks over large general-purpose analyzers
- CLI output is deterministic, concise, and diff-friendly
- Error messages are in Korean
- If formatting/lint tools are added, wire them into `npm run lint` and git hooks

## Testing Guidelines

- Directory: `tests/` (mirroring source structure)
- Naming: `*.test.ts` or `*.spec.ts`
- Framework: vitest
- Add tests alongside the first code scaffold
- Cover both pass and fail scenarios — especially missing-docs, missing-CI, and weak-hook cases
- Fixtures: sample repo configurations in `tests/fixtures/`. Use snapshots only when output is intentionally stable
- Pure functions in `scorer.ts` can be unit tested without an LLM

## Commit & Pull Request Guidelines

- Conventional Commits: `feat: add ci readiness check`, `docs: refine contributor guide`
- PRs should include: user-facing changes, new commands/config files, related issue links, and CLI output samples when behavior changes
- Do not commit `.omc/` or `.omx/` directories

## Architecture Notes

### Data Flow

```
CLI args → index.ts → git-log.ts (commit log pre-extraction)
  → analyzer.ts → engines/run.ts (Claude SDK / Codex CLI + Git Log Context) → LLMAnalysisOutput
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
- **Penalty**: Any required (`must`) category with grade F → overall grade capped at C

### Core Types

- `LLMAnalysisOutput`: Raw JSON returned by the LLM (categories + summary)
- `AnalysisResult`: Final result after scoring (grade, penalties included)
- `CATEGORY_WEIGHTS`: Defines tiers and weights for 7 categories (types.ts)
- `ANALYSIS_JSON_SCHEMA`: JSON Schema to enforce LLM output structure (types.ts)

### Extension Points

- New analysis category: add to `CATEGORY_WEIGHTS` + add a section to the prompt
- Additional output formats (JSON, HTML): add new functions to `reporter.ts`
- CI gate mode: add exit code return logic

## Repository-Specific Notes

- All checks must align with the evaluation criteria in `docs/ideation.md`
- Language agnostic: the LLM makes the judgment, not pattern matching
- Do not create broad "quality score" logic without clear justification — each check must explain what it examined and why it passed or failed
- Only `Read`, `Glob`, and `Grep` tools are allowed in the `query()` function of the Claude Agent SDK (`permissionMode: "dontAsk"`)
- Codex runs in an isolated directory with a read-only sandbox; never fall back to unrestricted execution. Codex does not support Claude's dollar-budget or turn limits.
- Engine identity must be preserved in cache keys and diagnosis snapshots. Missing engine on old snapshots means Claude; cross-engine comparison/resume overrides must be rejected.
- Treat the target repository as read-only (no modifications allowed)
- Process diagnosis (`--diagnose`) uses stable capability IDs and repository-type profiles instead of a global quality score. Follow `docs/process-diagnosis.md` and keep observations separate from hypotheses.
- Provider APIs are GET-only. Preserve explicit sampling gaps; never turn unavailable data into a passing assessment. Interview JSON must bind to a saved diagnosis's original questions.
