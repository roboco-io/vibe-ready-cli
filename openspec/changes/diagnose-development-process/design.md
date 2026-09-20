## Context

The user approved a CLI diagnosis workflow for development teams, heterogeneous repository profiles, actionable recommendations over scores, read-only repository plus GitHub/GitLab PR/CI evidence and team interviews. Existing scoring commands remain available. User changes under `.claude/` are out of scope.

## Goals / Non-Goals

**Goals:** inspect practical engineering capabilities, distinguish observations from hypotheses, support targeted interviews and comparable evidence-backed follow-up reports.

**Non-Goals:** automatic source fixes, posting comments or issues, executing target code, individual performance scoring, claiming deployment/incident outcomes from CI alone, changing existing scoring rubrics in this release.

## Decisions

- Add `--diagnose` to the existing command. Defaults: last 30 days, maximum 30 PR/MRs and CI runs, automatic provider/profile detection. Explicit `--provider none` supports offline repository-only diagnosis. No implicit cache or snapshot writes.
- Provider modules use GET-only Node fetch with bounded pagination, request timeouts and sanitized failures. Normalize PR/MR, review and CI records. Link PRs, CI and source via commit identifiers where available; never infer a causal link from coincident timing alone. Keep tokens outside prompts and serialized output.
- SDK tools remain exactly Read, Glob and Grep with dontAsk. A first investigation produces structured findings and up to three targeted questions. Interactive or JSON-file answers trigger a second synthesis with the same bounded total budget/time allowance. Non-TTY runs return outstanding questions and never hang.
- The rubric contains stable capability IDs for acceptance criteria, reproducible development, behavioral verification, feedback gates, changeability/context, traceability and profile-specific delivery. A missing optional tool is never a failure by itself. Source/test sampling is allowed without executing code.
- Every non-unknown finding cites collected evidence IDs or verified repository path/line/excerpts. Validate schema, uniqueness, known capability IDs, complete coverage, references and repository-bound citations before returning a report. Evidence text is untrusted data, not instructions.
- Metrics are computed in code with explicit denominators: sampled PR count, merged PR lead time, observed first-review delay and CI conclusion/retry counts. CI retry is a signal, not proof of flakiness. Missing timestamps stay unknown.
- Reports prioritize at most three actionable findings and retain all findings/questions/gaps. JSON snapshots include schema/rubric version, canonical repository identity, commit, profile, goal, window, metrics, evidence and interview responses.
- Comparison requires the same repository/profile/rubric/goal/window duration. Match fixed check IDs; only an explicit supported assessment in the new snapshot can resolve a prior problem. Missing/unknown evidence produces unconfirmed, not resolved. Scope/sample changes are displayed.
- Terminal and Markdown share a readable diagnosis report; `--json` emits machine-readable output. `--save-diagnosis` explicitly persists a snapshot, `--baseline` compares one. Output paths are caller-selected and overwrites of repository source files are rejected for diagnosis mode.

## Risks / Trade-offs

- Sampling and API permission gaps → display collection scope, truncation and missing evidence, never extrapolate to the whole organization.
- LLM causal overreach → separate observation/hypothesis and require an experiment plus success measure; no global quality score.
- Remote/API variability → fixture-backed provider tests, GET-only bounded collectors, partial results with gaps.
- Nondeterministic advice → deterministic underlying metrics, versioned rubric and stable check IDs, preserve evidence snapshots.
- Extra LLM round → shared run deadline and remaining budget, skip second round without answers.

## Migration Plan

Ship as opt-in mode with bilingual usage docs. Existing `vibe-ready [path]` stays unchanged. No dependency additions. Users explicitly opt into external reads by diagnosis mode/provider selection; credentials use documented environment variables.

## Open Questions

None blocking implementation. Defaults above are adjustable through CLI flags.
