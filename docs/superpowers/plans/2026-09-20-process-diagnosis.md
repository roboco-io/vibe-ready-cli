# Development Process Diagnosis Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` for orchestration and `superpowers:dispatching-parallel-agents` for the independent collector/report tasks. Test each component before implementation.

**Goal:** Deliver the approved read-only, evidence-driven development process diagnosis CLI.

**Architecture:** GET-only provider collectors normalize evidence and code computes metrics. The Claude agent investigates repository files and remote evidence, requests targeted interview answers and produces validated findings. A versioned snapshot supports explicit follow-up comparison.

**Tech Stack:** TypeScript ESM, Node >=24, native fetch/readline, Claude Agent SDK, commander, Vitest.

**Spec:** `openspec/changes/diagnose-development-process/design.md` and `specs/process-diagnosis/spec.md`.

## Global Constraints

- SDK tools: only Read, Glob, Grep; target repository read-only.
- Keep published command names and existing scoring behavior.
- Korean errors; 2-space indentation; `.js` imports.
- Do not touch user changes in `.claude/`, `.omc/` or `.omx/`.
- No new production dependencies, remote mutations or automatic source execution.

## Tasks

### 1. Shared contract and deterministic core
Files: `src/diagnosis/types.ts`, `rubric.ts`, `metrics.ts`; `tests/diagnosis/core.test.ts`.
Inputs: repo path, normalized PR/CI records. Outputs: profile, fixed check IDs, metrics with sample counts.
- [x] Write failing cases for absent timestamps, drafts, CI retries and ambiguous profile selection.
- [x] Run `npm test -- tests/diagnosis/core.test.ts`; implement only failed behavior; rerun.
- [x] Define the common contracts before dispatching independent tasks.

### 2. Provider collectors (independent)
Files: `src/diagnosis/providers.ts`, `provider-http.ts`; `tests/diagnosis/providers.test.ts`.
Interface: `collectRemoteEvidence(repoPath, options): Promise<RemoteCollection>`.
- [x] Test GET requests, provider detection, date/sample limits, pagination, partial/auth failures, no token serialization and GitLab URL encoding using fetch fixtures.
- [x] Observe failures; implement providers; rerun tests and TypeScript build.

### 3. Reporting and comparison (independent)
Files: `src/diagnosis/report.ts`, `compare.ts`; `tests/diagnosis/report.test.ts`.
Interfaces: `buildDiagnosisReport(snapshot, comparison?)`, `compareDiagnoses(before, after)`.
- [x] Test evidence links, unanswered questions, all statuses and scope differences; reject wrong repo/rubric/profile/goal/window.
- [x] Test that unknown/absent findings never resolve prior problems; implement and rerun.

### 4. Agent orchestration
Files: `src/diagnosis/agent.ts`, `validation.ts`, `prompt.ts`, `interview.ts`; tests alongside.
Interface: `diagnoseRepository(repoPath, options): Promise<DiagnosisSnapshot>` with injectable SDK query/interview boundary for tests.
- [x] Mock only SDK/network boundaries. Test malformed output, unknown IDs, path traversal/symlink citations, missing checks, budget exhaustion and missing answers.
- [x] Implement structured output schema, practical profile prompt and verified citations.
- [x] Use one total deadline/budget across investigation and interview synthesis; never ask on non-TTY unless caller supplies an interviewer.

### 5. CLI and documentation
Files: `src/diagnosis/cli.ts`, `src/index.ts`, `README.md`, `README.ko.md`, `docs/process-diagnosis.md`, `vitest.config.ts`.
- [x] Write CLI tests for help, invalid options, no-LLM report replay and output safety; observe failures.
- [x] Register diagnosis flags and isolated handling before legacy config/cache/branch logic. Add snapshot replay for offline review.
- [x] Limit Vitest discovery to root `tests/` so nested worktrees are excluded.
- [x] Document credential environment variables, interview JSON and snapshot comparison commands with examples.

### 6. Verification
- [x] Run `npm run build`, `npm test`, `node dist/index.js --help` and offline fixture CLI diagnosis/replay checks.
- [x] Independent review of completed diff; address substantive findings and rerun affected checks.
- [x] Mark OpenSpec tasks from verified results. Leave commits/publishing to explicit user instruction.
