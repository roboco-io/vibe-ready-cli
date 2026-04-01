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
