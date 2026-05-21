# Token Economics & Context Budgeting

## Kimi k2.6 Window Budget (262K tokens)

### Task Profiles
| Task Type | Context Budget | Max Output | Temperature |
|-----------|---------------|------------|-------------|
| Research / Architecture | 120K context | 4K | 0.4 |
| Multi-file Refactor | 80K context | 8K | 0.2 |
| Surgical Edit (single file) | 20K context | 2K | 0.1 |
| Debug / Explain | 40K context | 2K | 0.2 |
| Test Generation | 30K context | 4K | 0.1 |
| Summarize / Commit msg | 10K context | 1K | 0.0 |

### Pruning Rules
1. If a conversation exceeds 50K tokens, summarize the first 60% into a Session State block.
2. Discard terminal output older than 3 messages unless explicitly pinned.
3. Never include binary files, images, or audio in context.
4. Use @folder instead of @codebase when the question is module-scoped.

### KV Cache Optimization
- Keep system prompts static across requests (they are cached).
- Use /clear when switching topics entirely.
- Group related edits into one session rather than 5 separate chats.
