> 🇰🇷 [한국어 버전](02-deep-interview.ko.md)

# Chapter 2: Clarifying Requirements with Deep Interview

> **Time required**: ~25 minutes
> **Key Insight**: Before telling AI to "build it," converse with it until it precisely understands "what to build."

## Context

In Chapter 1 we wrote the ideation document, but much remains ambiguous: how scores are calculated, what the difference is between required and recommended items, and how far the MVP scope extends. To resolve this ambiguity, we conduct a **Deep Interview**.

The deep interview is a technique where the AI asks one Socratic question at a time to crystallize requirements. After each round it mathematically measures an **ambiguity score**, and when it drops below 20%, we move on to implementation.

## The Prompt

```
Read docs/ideation.md, conduct a deep interview to enrich the context, then generate a PRD.
```

A single-sentence prompt. But it contains three things:
1. **Input**: read ideation.md
2. **Method**: enrich context through deep interview
3. **Output**: generate a PRD (Product Requirements Document)

## What Happened: 10-Round Interview

The AI automatically entered deep interview mode, tracking weighted scores across 3 dimensions (Goal Clarity, Constraint Clarity, Success Criteria) while asking questions.

### Round 1 — "Who uses it, and when?" (Ambiguity 80%)

```
Q: Who are the primary users of this CLI, and in what scenario would they run it?
   (A) Developer self-check
   (B) Team lead batch evaluation
   (C) CI/CD pipeline gate
   (D) Composite (all of the above)

A: Composite (all of the above)
```

| Dimension | Score | Gap |
|-----------|-------|-----|
| Goal | 0.35 | Unclear what the judgment output looks like |
| Constraints | 0.10 | Tech stack, runtime undecided |
| Success Criteria | 0.10 | No acceptance criteria |

### Round 2 — "What form does the output take?" (Ambiguity 69%)

```
Q: How should the analysis results be delivered to the user?

A: Composite (score + grade + recommendations)
```

Confirmed as a comprehensive report including not just a score, but **grade + improvement recommendations**.

### Round 3 — "What's the tech stack?" (Ambiguity 60%)

```
Q: What tech stack would you like to implement this CLI with?

A: TypeScript + Node.js
```

### Round 4 (Contrarian Mode) — "Do you really need all 6?" (Ambiguity 54%)

The AI poses a **provocative question**:

```
Q: If passing just one of the 6 categories means "ready," which one matters most?
   Which ones could be dropped?

A: Hierarchical structure — separate required from recommended
```

This question gave birth to the **must vs. nice** concept.

### Round 5 — "Classify required vs. recommended" (Ambiguity 49%)

```
Q: Which of the 6 categories are must-have vs. nice-to-have?

A: Validation capability first
   Must: Testing, CI/CD, Hook validation
   Nice: Repo structure, Documentation, Vibe coding config
```

### Round 6 (Simplifier Mode) — "MVP scope" (Ambiguity 40%)

```
Q: If we build the simplest version first as an MVP, what scope does that cover?

A: Single repo + terminal output
```

JSON/HTML output, CI gate mode, and batch multi-repo checking were all deferred to follow-up versions.

### Round 7 — "Completion criteria" (Ambiguity 34%)

```
Q: What are the concrete criteria for determining the MVP is complete?

A: Validate with sample repos — success if running against real repos produces reasonable results
```

### Round 8 — "Analysis depth" (Ambiguity 27%)

```
Q: What specifically should we look for in each category? What's the depth of analysis?

A: File existence + content analysis (medium depth)
```

Execution-based analysis (actually running tests/lint) was deferred to a follow-up version; file parsing only was confirmed as the MVP scope.

### Round 9 — "Sample repos for validation" (Ambiguity 23%)

```
Q: What sample repos will we use to validate the MVP?

A: Use repos under the nextintelligence-ai org
```

### Round 10 — "Language-specific pattern support?" (Ambiguity 19% — PASSED!)

```
Q: Is it language agnostic, or does it support per-language patterns?

A: Use Claude Code SDK to analyze via LLM — AI judgment rather than pattern matching
```

This answer determined the project's core architecture: **LLM-based analysis rather than rule-based**.

## The Result: Ambiguity 100% → 19%

```
Final Ambiguity Score: 19% (PASSED, threshold: 20%)

| Dimension        | Score | Weight | Weighted |
|------------------|-------|--------|----------|
| Goal Clarity     | 0.90  | 0.40   | 0.36     |
| Constraint       | 0.75  | 0.30   | 0.225    |
| Success Criteria | 0.75  | 0.30   | 0.225    |
| Total Clarity    |       |        | 0.81     |
```

Ten rounds of questions and answers confirmed the following:

- **Users**: Developer self-check (MVP)
- **Tech stack**: TypeScript + Node.js, Claude Agent SDK
- **Analysis method**: LLM-based (not pattern matching)
- **Output**: Score + grade + improvement recommendations
- **Categories**: 3 required (Testing, CI/CD, Hooks) + 3 recommended (Structure, Docs, Vibe config)
- **Scoring**: Weighted average; any required category graded F → overall grade capped at C
- **MVP scope**: Single repo + terminal output only
- **Analysis depth**: File existence + content parsing

## Lessons Learned

1. **Ambiguity can be measured**: Quantifying ambiguity with weighted scores across 3 dimensions (Goal, Constraints, Success Criteria) lets you objectively judge "is this specific enough."

2. **Contrarian questions find the core**: The provocative question in Round 4 ("do you really need all of them?") surfaced the key design of separating required from recommended. Comfortable questions alone don't yield insights like this.

3. **Actively cut scope for MVP**: In Round 6, JSON output, CI gate, and multi-repo support were all boldly deferred. "Do everything" is the same as "do nothing."

4. **Technical decisions also emerge from the interview**: In Round 10, the core architectural decision of "LLM-based analysis" arose naturally. Letting technology choices emerge from the requirements conversation — rather than deciding them upfront — leads to better decisions.

## Try It Yourself

```bash
# Run deep interview in Claude Code
claude

# Enter the prompt
> Read docs/ideation.md and clarify requirements through a deep interview

# Or invoke the oh-my-claudecode skill directly
> /oh-my-claudecode:deep-interview
```

**Tip**: When answering, don't feel constrained by the multiple-choice options. You can freely offer "composite," "both," or an entirely new answer. The AI will recalculate ambiguity accordingly.

---

**Previous Chapter**: [01 - Ideation and Project Initialization](01-ideation-and-init.md)
**Next Chapter**: [03 - MVP Implementation](03-implementation.md)
