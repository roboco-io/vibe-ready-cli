> 🇰🇷 [한국어 버전](05-contribution-guide-and-skill.ko.md)

# Chapter 5: Contribution Guide and Automated Validation Skill

> **Time required**: ~10 minutes
> **Key Insight**: Contribution rules left only as documentation get forgotten. Turn them into a skill and agents enforce them automatically.

## Context

Once harness engineering (Chapter 4) is complete, working solo is well covered. But when other contributors — human or AI — join the project, they need a guide explaining **how to contribute**.

Going one step beyond simply writing a CONTRIBUTING.md, we turn it into a Claude Code **skill** so that guideline compliance is automatically validated whenever a contributor writes code.

## The Prompt

```
Create a contribution guide and turn it into a skill following the official Claude docs,
so contributors can automatically follow the contribution guidelines.
```

One sentence, three requests:
1. Create CONTRIBUTING.md
2. Convert to a Claude Code skill
3. Build an automatic validation mechanism

## What Happened

### 1. Writing CONTRIBUTING.md

The AI extracted coding conventions and architecture rules from the existing CLAUDE.md and AGENTS.md, then restructured them from a contributor's perspective:

```markdown
# Contributing to vibe-ready-cli

## Development Workflow
1. Check issues
2. Create branch (feat/, fix/, docs/)
3. Write code (follow coding conventions)
4. Write tests
5. Verify build
6. Commit (Conventional Commits)
7. Pull Request

## Coding Conventions
- Indentation: 2 spaces
- .js extension required for ESM imports
- File names: kebab-case
- Error messages: in Korean

## Architecture Rules
- Data flow: index → analyzer → scorer → reporter
- LLM-dependent logic only in analyzer.ts
- SDK tools: only Read, Glob, Grep allowed
```

The key to CONTRIBUTING.md is **not explaining why each rule exists**. The reasons are already in CLAUDE.md and AGENTS.md. CONTRIBUTING.md focuses solely on "what needs to be done."

### 2. Creating the contribution-guard Skill

Creates `.claude/skills/contribution-guard/SKILL.md`:

```yaml
---
name: contribution-guard
description: Automatically validates CONTRIBUTING.md guidelines when a contributor
  writes code or prepares a PR.
---
```

The skill's validation checklist:

| Area | Validation Items |
|------|-----------------|
| Coding conventions | Indentation, ESM .js extension, kebab-case, Korean error messages |
| Architecture | Data flow direction, LLM dependency isolation, SDK tool restrictions |
| Tests | Tests exist for changes, `npm test` passes |
| Commits | Conventional Commits format |
| Forbidden files | .omc/, .omx/, node_modules/, dist/, .env not included |

### 3. How the Skill Works

Once the skill is registered, a contributor (or AI agent) can run `/contribution-guard`, or the agent can invoke it automatically before committing:

```
Contribution Guard Validation Results
──────────────────────────────────────
✓ Coding conventions: passed
✓ Architecture rules: passed
✗ Tests: missing — no corresponding test for src/checks/new-check.ts
  → Add tests/checks/new-check.test.ts
✓ Commit message: N/A (not yet committed)
✓ Forbidden files: passed

Result: 1 item needs to be fixed
```

## The Result

```
692d282 docs: add vibe coding tutorial, contribution guide, and contribution-guard skill
 10 files changed, 985 insertions(+)
```

Files created:
- `CONTRIBUTING.md` — guide for contributors
- `.claude/skills/contribution-guard/SKILL.md` — automated validation skill

## Relationship to Harness Engineering

This chapter's work adds two more layers on top of the 3-layer structure from Chapter 4:

```
┌─────────────────────────────────────────────┐
│  Layer 1: Context (CLAUDE.md)               │
│  "What is this project and how does it work"│
├─────────────────────────────────────────────┤
│  Layer 2: Guidelines (AGENTS.md)            │
│  "What rules should the agent follow"       │
├─────────────────────────────────────────────┤
│  Layer 3: Guardrails (.claude/settings.json)│
│  "What can and cannot the agent do"         │
├─────────────────────────────────────────────┤
│  Layer 4: Contribution Guide (CONTRIBUTING.md) ← NEW
│  "How should external contributors participate" │
├─────────────────────────────────────────────┤
│  Layer 5: Auto Validation (contribution-guard) ← NEW
│  "Let the agent automatically enforce contribution rules" │
└─────────────────────────────────────────────┘
```

Layers 1–3 are the harness for **solo** work; Layers 4–5 are the harness for when a **team or community** participates.

## Lessons Learned

1. **Document → Skill conversion is the key**: With only CONTRIBUTING.md, humans must read and remember it. Turning it into a skill means the agent validates automatically. The "enforceability" of the rules changes entirely.

2. **Extract from the existing harness**: The content of CONTRIBUTING.md wasn't written from scratch — it was restructured from CLAUDE.md and AGENTS.md into a contributor's perspective. It's a "change of viewpoint," not duplication.

3. **Skills are validators, not checklists**: A simple checklist requires a human to review, but a skill analyzes `git diff` and actually runs tests. It provides "pass/fail" evidence instead of "I checked."

4. **Auto-fix minor violations, guide severe ones**: For minor issues like indentation, suggest automatic fixes; for serious issues like missing tests, only provide guidance on how to resolve them, helping contributors learn.

## Try It Yourself

```bash
# 1. Create CONTRIBUTING.md for your project
claude
> Write a CONTRIBUTING.md based on CLAUDE.md and AGENTS.md

# 2. Create the contribution-guard skill
> Turn this CONTRIBUTING.md into a Claude Code skill
> so contributors can automatically follow the guidelines

# 3. Run the skill
> /contribution-guard
```

**Tip**: Skills are written as markdown at `.claude/skills/<name>/SKILL.md`. Include `name` and `description` in the frontmatter and Claude Code will automatically recognize them.

---

**Previous chapter**: [04 - Harness Engineering](04-harness-engineering.md)

---

## Final Journey Summary

| Stage | Time | Key Output |
|-------|------|------------|
| Idea | ~5 min | `docs/ideation.md` (18 lines) |
| Project initialization | ~5 min | CLAUDE.md (initial version) |
| Deep interview | ~25 min | Requirements spec (19% ambiguity) |
| MVP implementation | ~40 min | 5 modules + 12 tests |
| Harness engineering | ~15 min | CLAUDE.md + AGENTS.md + settings.json |
| Contribution guide + skill | ~10 min | CONTRIBUTING.md + contribution-guard skill |
| **Total** | **~1 hour 40 min** | **Working CLI + complete harness + contribution system** |
