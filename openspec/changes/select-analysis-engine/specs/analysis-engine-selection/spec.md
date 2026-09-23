## ADDED Requirements

### Requirement: Independent engine selection
The CLI SHALL support `--engine claude|codex` in scoring and diagnosis, independently of harness and forge options. It MUST default to Claude and honor CLI over configuration.

#### Scenario: Codex with Claude harness focus
- **WHEN** scoring uses `--engine codex --agent claude`
- **THEN** Codex performs the analysis and evaluates Claude-specific harness configuration

### Requirement: Read-only execution and valid results
Both engines SHALL enforce their read-only execution policy and return structured results. Codex failure MUST NOT silently fall back to an unrestricted process or Claude. Timeout MUST terminate the owned process and clean temporary files.

#### Scenario: Missing Codex installation
- **WHEN** Codex cannot be launched
- **THEN** the CLI returns a Korean installation/authentication hint without changing the target repository

#### Scenario: Unsupported execution limits
- **WHEN** a Codex invocation explicitly requests a Claude-only USD budget or turn limit
- **THEN** the CLI rejects the option before an analysis call

### Requirement: Engine provenance
Cache entries and diagnosis snapshots SHALL distinguish engines. Legacy snapshots MUST be treated as Claude. Offline replay SHALL not invoke either engine.

#### Scenario: Engine switch with cached score
- **WHEN** a Claude result is cached and Codex is selected
- **THEN** the Claude result is not reused for Codex

#### Scenario: Resume a Codex interview
- **WHEN** a saved Codex diagnosis is resumed without an engine override
- **THEN** the original questions are synthesized by Codex even though no USD cost is reported

#### Scenario: Cross-engine comparison
- **WHEN** snapshots from different engines are compared
- **THEN** comparison fails with an actionable Korean error
