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
