## Why

Users need to select Claude Agent SDK or Codex as the analysis engine for scoring and process diagnosis. The existing `--agent` chooses the harness being evaluated, not the engine performing analysis.

## What Changes

- Add `--engine claude|codex` and an optional configuration `engine`; keep Claude as the default.
- Share engine dispatch across scoring, diagnosis and interview resumption.
- Add a Codex CLI adapter with structured JSON output, read-only sandbox, isolated invocation configuration, bounded output, timeout/cancellation and temporary-file cleanup.
- Separate caches by engine and record engine provenance in diagnosis snapshots; infer Claude for older snapshots.
- Explicitly reject Claude-only budget/turn flags for Codex rather than implying unsupported limits are enforced.
- Document installation/authentication and both engine workflows.

## Capabilities

### New Capabilities
- `analysis-engine-selection`: Engine selection, execution and provenance across analysis modes.

### Modified Capabilities
None. Existing published command names and harness selection stay compatible.

## Impact

`src/engines/`, scoring analyzer, diagnosis runner/CLI/snapshots, config/cache, CLI and bilingual documentation. No new npm production dependency; Codex users install and authenticate the Codex CLI. No release or publish is included in this change.
