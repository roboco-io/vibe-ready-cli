> 🇰🇷 [한국어 버전](AGENTS.ko.md)

# Repository Guidelines

## Project Structure & Module Organization

```
src/
  index.ts           # CLI entrypoint (commander)
  analyzer.ts        # Repo analysis based on Claude Agent SDK
  scorer.ts          # Weighted average scoring + penalty logic
  reporter.ts        # Terminal report output (chalk)
  types.ts           # Types, scoring model, JSON schema
  prompts/
    analyze.ts       # LLM analysis prompts
tests/
  fixtures/          # Sample repositories (pass/fail scenarios)
docs/
  ideation.md        # Initial planning document
```

When adding a new check module, create it as a single-responsibility file in the `src/checks/` directory. Do not edit or commit `.omc/` or `.omx/` — these are local tool state.

## Build, Test, and Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile tsc → dist/
npm test             # vitest run (unit/integration tests)
npm run test:watch   # vitest watch mode
```

Run: `npx tsx src/index.ts [path] [-v]` (development), `node dist/index.js [path]` (after build)

Authentication: Uses Claude Code subscription auth (no separate API key required).

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
CLI args → index.ts → analyzer.ts (Claude SDK query) → LLMAnalysisOutput
  → scorer.ts (computeResult) → AnalysisResult
  → reporter.ts (printReport) → terminal output
```

### Core Types

- `LLMAnalysisOutput`: Raw JSON returned by the LLM (categories + summary)
- `AnalysisResult`: Final result after scoring (grade, penalties included)
- `CATEGORY_WEIGHTS`: Defines tiers and weights for 6 categories (types.ts)
- `ANALYSIS_JSON_SCHEMA`: JSON Schema to enforce LLM output structure (types.ts)

### Extension Points

- New analysis category: add to `CATEGORY_WEIGHTS` + add a section to the prompt
- Additional output formats (JSON, HTML): add new functions to `reporter.ts`
- CI gate mode: add exit code return logic

## Repository-Specific Notes

- All checks must align with the evaluation criteria in `docs/ideation.md`
- Do not create broad "quality score" logic without clear justification — each check must explain what it examined and why it passed or failed
- Only `Read`, `Glob`, and `Grep` tools are allowed in the `query()` function of the Claude Agent SDK
- Treat the target repository as read-only (no modifications allowed)
