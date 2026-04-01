# Repository Guidelines

## Project Structure & Module Organization
This repository is still documentation-first. The only tracked product artifact today is [`docs/ideation.md`](docs/ideation.md), which defines the CLI goal: inspect a repository and judge whether it is ready for "vibe coding" based on structure, tests, documentation, CI/CD, hooks, and agent/config files such as `AGENTS.md` or `CLAUDE.md`.

Keep long-form notes in `docs/`. Treat `.omc/` as local tool state; do not edit or commit it. When implementation starts, keep executable CLI code in `src/`, reusable checks in `src/checks/`, and fixtures or sample repositories in `tests/fixtures/`.

## Build, Test, and Development Commands
No build toolchain is committed yet. The first implementation should expose one clear command surface through `package.json` or a `Makefile` and document it here. Minimum expected commands:

- `npm run dev` or equivalent: run the CLI against a target repository during development.
- `npm run build`: produce a distributable CLI package.
- `npm test`: run unit and integration coverage for repository checks.
- `npm run lint`: enforce formatting and static rules.

Keep command names stable once published.

## Coding Style & Naming Conventions
Prefer small, single-purpose checks over large generic analyzers. Use 2-space indentation for Markdown, JSON, YAML, and JavaScript/TypeScript. Name files by responsibility, such as `docs-check.ts`, `ci-check.ts`, or `hooks-check.ts`. Keep CLI output deterministic, concise, and easy to diff.

If you add formatting or lint tooling, wire it into `npm run lint` and any git hooks rather than requiring ad hoc commands.

## Testing Guidelines
Add tests with the first code scaffold. Mirror source structure under `tests/` and use `*.test.*` or `*.spec.*` naming. Cover both passing and failing repositories, especially missing-docs, missing-CI, and weak-hook scenarios. Prefer fixtures and snapshots only when the output is intentionally stable.

## Commit & Pull Request Guidelines
This repository has no commit history yet, so adopt Conventional Commits from the start: `feat: add ci readiness check`, `docs: refine contributor guide`. Pull requests should explain the user-visible change, note any new commands or config files, link related issues, and include sample CLI output when behavior changes.

## Repository-Specific Notes
Keep new checks aligned with the evaluation criteria in `docs/ideation.md`. Avoid broad "quality score" logic without clear evidence; each check should explain what it inspected and why it passed or failed.
