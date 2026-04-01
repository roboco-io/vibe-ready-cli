> 🇰🇷 [한국어 버전](01-ideation-and-init.ko.md)

# Chapter 1: Ideation and Project Initialization

> **Time required**: ~10 minutes
> **Key Insight**: Vibe coding starts not with code, but with clearly writing down "what you're going to build."

## Context

Every vibe coding project begins with an ideation document. For an AI agent to generate code, it needs to know "what to build," and that starting point is the ideation document.

The idea for this project was simple: build a **CLI tool that analyzes how ready a repository is for vibe coding**.

## Step 1: Write the Ideation Document

The first thing we did was organize the idea in `docs/ideation.md`. It doesn't need to be a finished document — a seed-level sketch of your thinking is enough.

```markdown
# Vibe Ready Reader

- This project is a reader that analyzes various data from a repository to determine whether it is prepared for vibe coding.
- The interface is provided as a CLI.
- Readiness for vibe coding is determined by analyzing the following elements:
  - Repository structure
  - Test coverage
  - Documentation level
  - CI/CD
  - Validation via hooks
    - lint, ut, it, e2e, spec validation
  - Settings for vibe coding
    - Rule files
      - CLAUDE.md (or AGENTS.md)
    - Various hooks
    - Skills
    - Agents
```

An 18-line document. But it contains the entire core of the project: **what** (a reader), **how** (CLI), **what to analyze** (6 categories).

### Lesson: It Doesn't Have to Be Perfect

The ideation document is intentionally incomplete. Questions like "how will we score it" and "what tech stack will we use" are left unanswered. This ambiguity is resolved in the next chapter's deep interview.

## Step 2: Generate CLAUDE.md with /init

After initializing the Git repository, run the `/init` command in Claude Code.

### The Prompt

```
/init
```

That's all. `/init` is a built-in command that has Claude Code analyze the project and automatically generate a `CLAUDE.md` file.

### What Happened

Claude Code scanned the project directory, read the existing files (only `docs/ideation.md`), and generated the initial `CLAUDE.md`:

```
This project is still in its early stages, with no code other than docs/ideation.md.
I will write CLAUDE.md based on the ideation document.
```

The generated CLAUDE.md was minimal — just a list of the project overview and analysis items. But this becomes **the first foothold for the agent to understand the project**.

### The Result

```
CLAUDE.md file has been created.
Since the project is still in the ideation stage with no code, build system, or tests,
it was written with minimal content based on the current documentation.
```

## Lessons Learned

1. **The ideation document comes first**: Write down "what you're going to build" before any code. An AI agent can start working even without code, as long as there is a document.

2. **`/init` works on empty projects too**: Even for a greenfield project with no code, running `/init` will generate a basic CLAUDE.md. As the project evolves, you can flesh out this file over time.

3. **An imperfect start is good**: The ambiguity in the ideation document is not a weakness — it becomes the input for the next stage (deep interview). There's no need to be perfect from the start.

## Try It Yourself

```bash
# 1. Create a new project directory
mkdir my-vibe-project && cd my-vibe-project
git init

# 2. Write the ideation document
mkdir docs
cat > docs/ideation.md << 'EOF'
# My Project Idea

- [Write your idea here]
- Interface: [CLI / Web / API / ...]
- Core features:
  - [Feature 1]
  - [Feature 2]
EOF

# 3. Run /init in Claude Code
claude  # Launch Claude Code, then enter /init
```

---

**Next Chapter**: [02 - Clarifying Requirements with Deep Interview](02-deep-interview.md)
