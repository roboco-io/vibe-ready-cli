## Context

The user explicitly requested Claude Agent SDK/Codex selection. Both scoring and process diagnosis currently call Claude directly. Codex CLI 0.155.1 is installed and authenticated with ChatGPT. Existing `--agent` is the harness evaluation focus and `--provider` selects the forge; neither is repurposed.

## Goals / Non-Goals

**Goals:** engine selection in both modes, configuration defaults, correct cache/provenance handling, working interview resumption, no target writes, tested error/abort behavior.

**Non-Goals:** automatic engine fallback, arbitrary model marketplace, publishing a new release, estimating unreported Codex dollar costs.

## Decisions

- `--engine claude|codex` overrides config `engine`; Claude remains default. An engine-only config inherits default categories. Diagnosis reads only the engine preference, not legacy rubric settings. Snapshot replay requires no engine executable; resume defaults to the saved engine and rejects explicit conflicting selection.
- Introduce `EngineRequest`/`EngineResult` and a common `runAnalysisEngine`. Keep Claude SDK tools restricted to Read/Glob/Grep and preserve diagnosis hooks. Codex invokes installed `codex exec` without a shell using stdin, JSON Schema, JSONL events, read-only sandbox and approval policy never. No API-key dependency is introduced; CLI saved authentication is reused.
- Launch Codex in an isolated temporary working directory outside the target, with user config/rules ignored, project instructions disabled and web search disabled. The prompt explicitly identifies the real target. This avoids inheriting repository MCP/hook configuration. OS read-only sandbox protects the repository; it is not claimed to be a path-scoped Read/Grep hook equivalent. Temporary schema/output files are removed on success and failure.
- Codex CLI lacks Claude-compatible dollar budget and agent-turn caps. Explicit `--max-budget`/`--max-turns` with Codex fail before execution; defaults do not imply those caps. Shared timeout/cancellation remains effective, and Codex interviews are not disabled merely because USD cost is absent.
- Add engine to scoring cache keys and bump cache version. New snapshots store engine; missing engine in v0.5 snapshots means Claude. Cross-engine baseline comparison and resume overrides are rejected so engine changes cannot masquerade as process improvements.
- Prefer installed CLI integration over another SDK dependency: reuses existing login, exposes configuration isolation flags and keeps the package dependency graph unchanged. No unsafe sandbox fallback on failure.

## Risks / Trade-offs

- CLI version drift → document tested version, clear unsupported flag/install errors; test argument contract and real smoke invocation.
- Secret/environment inheritance → do not echo prompts/CLI stderr; isolate shell environment and configuration, redact diagnostic failures.
- Codex can use read-only shell tools rather than Claude's named tools → explicitly describe this distinction; prompts prohibit target execution and output citations are still checked.
- Partial output, cancellation and spawned processes → require successful completed execution plus valid final JSON, bound buffers, terminate owned process tree and clean temporary files.

## References

- https://developers.openai.com/codex/noninteractive/
- https://developers.openai.com/codex/config-reference/
