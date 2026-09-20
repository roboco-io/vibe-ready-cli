> 🇰🇷 [한국어 버전](ideation.ko.md)

# Vibe Ready Reader

- This project is a reader that analyzes various data from a repository to determine whether it is prepared for vibe coding.
- The interface is provided as a CLI.
- Readiness for vibe coding is determined by analyzing the following factors:
  - Repository structure
  - Test coverage
  - Documentation level
  - CI/CD
  - Validation via hooks
    - lint, ut, it, e2e, spec validation
  - Configuration for vibe coding
    - Rule files
      - CLAUDE.md (or AGENTS.md)
    - Various hooks
    - Skills
      - Agents

## Development-process diagnosis

The opt-in `--diagnose` mode helps development teams prepare for AI-assisted work and revisit concrete improvements. It assesses acceptance criteria, reproducible development, behavioral/regression verification, feedback gates, changeability/context, traceability, and delivery appropriate to the repository type.

Evidence comes from read-only repository inspection, GitHub/GitLab PR/MR and CI records, and targeted team interviews. Checks explain the observed problem, evidence, separate cause hypothesis, minimal improvement, completion criteria, and a way to observe progress. Configuration counts and tool adoption are not proxies for engineering effectiveness. Missing evidence is unknown, and irrelevant criteria are explicitly not applicable.

Profiles cover services, libraries, CLIs, data workflows and general repositories. Comparisons use stable capability IDs and matching observation scope. Deployment or incident outcomes are not inferred from PR/CI records alone. See [process diagnosis](process-diagnosis.md).
