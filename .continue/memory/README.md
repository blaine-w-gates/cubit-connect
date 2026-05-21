# Session Memory

This directory is for Kimi to write persistent session summaries.

## How It Works
- After significant milestones, Kimi writes a summary here
- On new sessions, the `project-context.md` rule auto-loads relevant memory
- Memory files are append-only (never delete, only add)

## File Naming
- `YYYY-MM-DD_HH-MM_topic.md` — specific session
- `decisions.md` — architectural decisions that must persist
- `lessons.md` — corrections given to Kimi (so it remembers)
- `api-evolution.md` — how APIs have changed over time

## Template for New Memory
```markdown
## Date: YYYY-MM-DD
## Topic: [short name]
## Context: [what we were doing]
## Decision: [what we decided]
## Rationale: [why]
## Rejected Alternatives: [what we did NOT do and why]
## Related: [links to other memory files]
```
