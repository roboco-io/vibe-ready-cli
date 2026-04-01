> 🇰🇷 [한국어 버전](README.ko.md)

# Vibe Coding Tutorial: vibe-ready-cli

> From a single line of an idea to a working CLI tool — the full journey with an AI agent

This tutorial is a hands-on vibe coding workbook documenting the actual process of building the `vibe-ready-cli` project with Claude Code. It contains real prompts, decisions, failures, and insights extracted directly from conversation logs.

## Target Audience

- Developers new to Claude Code
- Anyone interested in vibe coding (AI agent-driven development)
- Those who want to apply harness engineering concepts to real projects

## Prerequisites

- Node.js >= 18
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- Claude Code subscription (required for Agent SDK usage)

## Table of Contents

| Chapter | Title | Key Content |
|---------|-------|-------------|
| [01](01-ideation-and-init.md) | Ideation and Project Initialization | Writing the ideation document, generating CLAUDE.md with `/init` |
| [02](02-deep-interview.md) | Clarifying Requirements with Deep Interview | 10-round Q&A reducing ambiguity from 100% to 19% |
| [03](03-implementation.md) | MVP Implementation | Building analyzers, scorers, and reporters using Claude Agent SDK |
| [04](04-harness-engineering.md) | Harness Engineering | Enhancing CLAUDE.md, AGENTS.md, settings.json, hook configuration |
| [05](05-contribution-guide-and-skill.md) | Contribution Guide and Auto-Validation Skill | Writing CONTRIBUTING.md, automated validation with the contribution-guard skill |

## Full Timeline

```
05:17 — Project started, ideation document written
05:25 — CLAUDE.md initially generated with /init
05:28 — Deep interview started (Round 1, ambiguity 100%)
05:49 — Deep interview completed (Round 10, ambiguity 19%)
05:50 — MVP implementation started (CLI + analysis engine + scorer + reporter)
06:30 — Harness engineering started
06:41 — Harness engineering committed
06:45 — Contribution guide + contribution-guard skill created
06:55 — Full commit and push completed
```

## Total Time Spent

Approximately **1 hour 40 minutes** (idea → working CLI + harness engineering + contribution framework)

---

_last_generated: 2026-04-01T06:55:00Z_
_last_log_session: ee266d92-9f23-48c9-9576-dc19f987f463_
