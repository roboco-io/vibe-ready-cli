# Contributing to vibe-ready-cli

Thank you for contributing to vibe-ready-cli! This document is a guide to ensure consistency and quality throughout the contribution process.

## Getting Started

```bash
git clone https://github.com/roboco-io/vibe-ready-cli.git
cd vibe-ready-cli
npm install
npm run build
npm test
```

**Requirements**: Node.js >= 24

## Development Workflow

### 1. Check for Existing Issues

Before starting work, check whether a related issue already exists. If not, create one first.

### 2. Create a Branch

```bash
git checkout -b feat/my-feature   # new feature
git checkout -b fix/bug-name      # bug fix
git checkout -b docs/topic        # documentation change
```

### 3. Write Code

#### Coding Conventions

- **Indentation**: 2 spaces (TS, JSON, YAML, MD)
- **Modules**: ESM (`"type": "module"`, `.js` extension required in imports)
- **File naming**: Responsibility-based kebab-case (`docs-check.ts`, `ci-check.ts`)
- **Error messages**: Korean
- **Check modules**: Single responsibility principle — one file per check

#### Architecture Rules

- **Follow the data flow**: `index.ts → analyzer.ts → scorer.ts → reporter.ts`
- **Separate LLM logic from pure logic**: Only `analyzer.ts` depends on the Claude SDK; `scorer.ts` and `reporter.ts` are pure functions
- **When adding a new analysis category**: Add an entry to `CATEGORY_WEIGHTS` in `types.ts` + add a prompt section in `prompts/analyze.ts`
- **Target repository is read-only**: Never modify the repository being analyzed
- **SDK tool restrictions**: Use only `Read`, `Glob`, `Grep` (`permissionMode: "dontAsk"`)

### 4. Write Tests

All code changes require tests.

- **Directory**: `tests/` (mirroring source structure)
- **Naming**: `*.test.ts`
- **Framework**: vitest
- **Required coverage**:
  - Cover both pass and fail scenarios
  - Especially missing-docs, missing-CI, and weak-hook cases
  - Pure functions in `scorer.ts` must be unit-tested without LLM
- **Fixtures**: Place sample repository configurations in `tests/fixtures/`

```bash
npm test              # run all tests
npm run test:watch    # watch mode
```

### 5. Verify the Build

```bash
npm run build
```

A failed build will block your commit (PreCommit hook).

### 6. Commit

Follow **Conventional Commits** format:

```
feat: add ci readiness check
fix: correct penalty calculation for edge case
docs: update scoring rules documentation
test: add fixtures for monorepo scenario
refactor: extract grade calculation to utility
```

| Prefix | Purpose |
|--------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation change |
| `test` | Add or update tests |
| `refactor` | Code improvement without behavior change |
| `chore` | Build or configuration change |

### 7. Pull Request

When writing a PR, include:

- **User-facing changes** (what is different)
- **New commands or configuration files** (if any)
- **Sample CLI output** (if behavior has changed)
- **Link to related issue**

## What Not to Commit

| Directory/File | Reason |
|----------------|--------|
| `.omc/` | Local agent tool state |
| `.omx/` | Local agent tool state |
| `node_modules/` | Dependencies (restored via npm install) |
| `dist/` | Build artifacts |
| `.env` | Environment variables (may contain secrets) |

## Guide for Adding a New Check Module

1. Add a new category to `CATEGORY_WEIGHTS` in `types.ts`
2. Add an analysis prompt section in `prompts/analyze.ts`
3. Add test fixtures (`tests/fixtures/`)
4. Verify alignment with the evaluation criteria in `docs/ideation.md`

## Questions?

Open an issue or leave a comment on a PR.
