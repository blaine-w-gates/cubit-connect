# Specification Engineering (Vibe Coder Edition)

## The Golden Rule
Never write implementation code immediately based on a vague request. Translate the user's plain English ideas into a structured plan before coding.

## The Auto-Specification Protocol
When the user asks for a new feature, a fix, or points out a bug, execute this automatically:

1. Understand the Vibe: Read the user's plain English request.
2. Gather Context: Identify which files are involved. If not enough context, ask the user to open relevant files in VS Code.
3. Propose the Plan: Reply with a Change Manifest:
   - The Goal: What we are trying to achieve.
   - Files to Touch: Exact file paths.
   - The Logic: 2-3 step explanation.
   - The Risk: One thing that could go wrong.
4. Ask for the Green Light: End with "Shall I go ahead and write this code?"

## Skepticism Mandate
Before any significant edit, list 3 reasons your approach might fail.

## Code Quality Standards
Once the user says yes:
- Complete Blocks: Never use ... to skip code.
- Production Ready: Handle errors gracefully.
- Explain How to Test: Provide exact, click-by-click verification instructions.
