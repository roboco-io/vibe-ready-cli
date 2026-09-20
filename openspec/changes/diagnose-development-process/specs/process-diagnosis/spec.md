## ADDED Requirements

### Requirement: Bounded read-only evidence collection
The CLI SHALL collect repository and selected GitHub/GitLab PR/MR, review and CI evidence with explicit time/sample limits, GET-only requests and no repository mutation. Unavailable data MUST be reported as gaps.

#### Scenario: Authentication fails
- **WHEN** a provider rejects credentials
- **THEN** local diagnosis remains possible and the report contains a sanitized collection gap, not fabricated zero activity

#### Scenario: Pagination reaches a limit
- **WHEN** more records exist than the configured bound
- **THEN** the report identifies sampling/truncation and uses observed denominators

### Requirement: Practical grounded diagnosis
The agent SHALL assess stable engineering capabilities using the selected repository profile, source/test evidence and process records. Non-unknown findings MUST have validated citations, observations, distinct hypotheses and actionable completion criteria.

#### Scenario: Hallucinated reference
- **WHEN** an agent returns an unknown evidence ID or an invalid local citation
- **THEN** the diagnosis is rejected with a Korean validation error

#### Scenario: Unsupported capability
- **WHEN** evidence is insufficient to assess a capability
- **THEN** it is marked unknown rather than failed or successful

### Requirement: Targeted team interview
The system SHALL support up to three agent-generated interview questions, interactive answers and JSON-file answers. Noninteractive input MUST NOT block; unanswered questions SHALL remain visible.

#### Scenario: Answers are supplied
- **WHEN** the team supplies answers
- **THEN** the agent synthesizes an updated diagnosis referencing those answers within the remaining total budget and deadline

### Requirement: Reproducible metrics and follow-up
The CLI SHALL emit versioned JSON snapshots and readable reports, with deterministic metrics and explicit scope. Comparisons MUST reject incompatible baselines and MUST NOT interpret missing findings as resolved.

#### Scenario: A finding becomes unknown
- **WHEN** an earlier problem has insufficient evidence in the follow-up
- **THEN** comparison reports it as unconfirmed

#### Scenario: Existing command invocation
- **WHEN** `--diagnose` is absent
- **THEN** the published scoring workflow remains available with its existing options
