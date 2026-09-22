# Analysis Engine Selection Implementation Plan

> **For agentic workers:** Use inline execution with `superpowers:dispatching-parallel-agents` for the isolated adapter and CLI/config tasks. Test each boundary before implementation.

**Goal:** Select Claude Agent SDK or Codex for scoring and process diagnosis.
**Architecture:** Shared engine dispatcher preserves Claude hooks and uses an isolated read-only Codex CLI adapter. CLI/config resolve engine identity; caches and snapshots retain that identity.
**Tech Stack:** TypeScript/Node24, existing Claude Agent SDK, installed Codex CLI, Vitest; no new npm dependencies.
**Spec:** `openspec/changes/select-analysis-engine/design.md` and `specs/analysis-engine-selection/spec.md`.

## Global Constraints

- Keep `--agent` as harness focus and `--provider` as forge provider; preserve published command names.
- Claude SDK tools remain Read/Glob/Grep. Codex uses read-only sandbox with no unsafe fallback.
- No target-repository writes; no credentials in prompts/logs/output; Korean errors.
- Codex does not advertise unsupported dollar/turn limits; shared timeout is enforced.
- Do not commit/release this change unless asked; preserve unrelated `.claude/` changes.

## 1. Shared execution contract
Files: `src/engines/{types,selection,run}.ts`, `tests/engines/run.test.ts`.
Interface: `runAnalysisEngine(engine:EngineId, request:EngineRequest, dependencies?:EngineDependencies):Promise<EngineResult>`.
- [x] Test explicit routing, unknown engines, failed/partial SDK results and abort propagation using an injected query/runner.
- [x] Implement shared dispatch; preserve Claude structured output, cost/turn accounting and hooks.

## 2. Codex adapter (parallel)
Files: `src/engines/codex.ts`, `tests/engines/codex.test.ts`.
Interface: `runCodex(request:EngineRequest):Promise<EngineResult>`.
- [x] Exercise actual child-process boundaries with a test executable: argv/stdin/schema, successful output, malformed output/nonzero exit, missing executable, abort/cleanup and output limits.
- [x] Implement shell-free spawn, temporary schema/result outside target, read-only sandbox, no loaded user/project execution config, stdin prompt and JSONL parsing. Never print raw stderr/prompt or estimate dollar cost.

## 3. Selection, cache and user interface (parallel)
Files: `src/index.ts`, `src/config.ts`, `src/cache.ts`, `src/diagnosis/cli.ts`, README files, relevant tests.
- [x] Test CLI-over-config selection, engine-only config, distinct cache entries, unsupported flags and offline replay.
- [x] Add `--engine`, pass resolved choice to both modes, separate cache keys, keep old flags unambiguous.
- [x] Document Codex installation/login, timeout-only limits and saved-engine resume.

## 4. Agent integration and provenance
Files: `src/analyzer.ts`, `src/diagnosis/{agent,types,validation,compare,report}.ts`, tests alongside.
- [x] Test Codex scoring and interview synthesis without USD usage; prior Claude tests remain regression coverage.
- [x] Record engine in snapshots, interpret old snapshots as Claude, retain stored engine for resume, reject conflicting overrides and cross-engine comparisons.

## 5. Verification
- [x] Run `npm run build`, `npm test`, `openspec validate select-analysis-engine --strict`, CLI help/invalid-option checks and a bounded real Codex analysis of a temporary fixture.
- [x] Independent review; fix substantive findings and rerun affected checks.
