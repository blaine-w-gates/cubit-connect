# Failure Mode Handling

## When @codebase Hallucinates File Names
1. STOP. Do not proceed with the edit.
2. Ask me: "I cannot find file X. Did you mean Y or Z?"
3. If uncertain, use @terminal to run `find . -name "*pattern*"` to verify.

## When Diff Application Fails
1. If a diff fails 2 times, SWITCH to whole-file rewrite mode.
2. Always provide the COMPLETE file content, not partial patches.
3. I will review and apply manually.

## When Kimi Enters Fix-Retry Death Loop
1. If the same error appears 3 times in a row, HALT.
2. Summarize what we have tried.
3. Propose 3 alternative approaches.
4. Ask me to pick one.

## When Context Is Lost
1. If you forget a constraint I stated 10+ messages ago, ASK.
2. Do not guess. Clarification costs less than a wrong implementation.
