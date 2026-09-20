## Why

The current CLI rewards configuration presence rather than explaining engineering problems. Teams need actionable, evidenced advice across heterogeneous repositories and a way to revisit improvements, using repository contents, PR/MR and CI history, and team interviews.

## What Changes

- Add an opt-in `--diagnose` workflow without renaming or replacing published CLI commands.
- Collect bounded, read-only GitHub/GitLab evidence and deterministic metrics; continue with explicit coverage gaps when remote data is unavailable.
- Use a read-only LLM agent to investigate practical engineering capabilities, request a short team interview, and produce evidence-linked observations, hypotheses and improvement experiments.
- Support service, library, CLI, data and general profiles, with unknown/not-applicable statuses and no invented quality score.
- Export versioned JSON diagnosis snapshots and Markdown reports; compare compatible snapshots without treating omitted findings as resolved.

## Capabilities

### New Capabilities
- `process-diagnosis`: Read-only evidence collection, agent investigation, team interview and longitudinal improvement reporting.

### Modified Capabilities
None. Existing scoring mode remains compatible.

## Impact

New modules under `src/diagnosis/`, CLI options, tests and bilingual documentation. Uses built-in Node fetch plus existing Claude Agent SDK; no new production dependency. API credentials are environment variables and are never included in evidence. No remote mutations, repository checkout or implicit target-repository writes.
