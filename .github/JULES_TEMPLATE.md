# Jules AI Interaction Protocol

Use this template when submitting checks, bugs, or feature requests to Jules.

---

## 1. Context & Scenario
**Current State / Error Logs:**
<!-- Paste relevant logs, screenshots, or describe current behavior here -->

**User Intent:**
<!-- What were you trying to achieve? What is the expected behavior vs actual behavior? -->

**Relevant Files:**
<!-- List the specific files involved (e.g., specific test files or component files) -->

## 2. The "Why" (Strategic Intent)
**Rationale:**
<!-- Explain *why* this change is needed. This helps avoid "XY Problems" where we solve the wrong thing. -->

## 3. Debugging Directives
**Special Focus Areas:**
- **Ambiguity Check:** Explicitly check for ambiguous locators (e.g., text that matches multiple elements like "Quota" vs "Quota Warning").
- **Hidden State:** Verify if the UI state (e.g., loading spinners, disabled buttons) accurately reflects the internal application state.
- **Race Conditions:** Look for potential timing issues in async operations or tests.

## 4. Required Output Format
**Before writing any code, please provide:**
1.  **Root Cause Analysis**: Explain *why* the issue is happening (not just *what* is failing).
2.  **Proposed Plan**: A step-by-step plan for approval.

## 5. Troubleshooting (Known Issues)
**Render Workspace Error:**
If you encounter `no workspace set. Prompt the user to select a workspace`, this is a safety feature of the Render integration.
**The Fix:**
1.  Ask: "List my Render workspaces"
2.  Then ask: "Set my Render workspace to [Name]"
3.  Retry the command.

**Git Push Failures:**
If you "complete" a task but the code doesn't appear in the repo, or the branch is missing:
**The Fix:**
1.  **Explictly Run:** `git status` and `git branch -a` to verify your state.
2.  **Force Push:** If `git push` fails silently, try `git push origin [branch-name]`.
3.  **Fallback:** If all else fails, **output the full file content** in the chat so I can apply it manually.
