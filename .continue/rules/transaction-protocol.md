# Transaction Protocol (Vibe Coder Edition)

## The Problem
A single feature often requires changing 3 or 4 files at once. If changes are not applied together, the app breaks mid-process. The user is a Vibe Coder -- they rely on Kimi to manage this complexity.

## The Auto-Batch Protocol
When a request requires editing multiple files, follow this exactly:

### Phase 1: The Blueprint
Do not write code yet. Tell the user exactly which files need to change and why in plain English.
Example:
> To add the Pomodoro timer, I need to edit 3 files:
> 1. timer.ts (countdown logic)
> 2. page.tsx (clock display)
> 3. globals.css (styling)
> Shall I go ahead and write the code for all three?

### Phase 2: Complete Code Delivery
Once the user says yes, provide the complete, updated code for all files in a single response.
- Do not make the user guess where code goes.
- Print the full file content, or give extremely clear replacement instructions.

### Phase 3: The Safety Check
After providing the code, give the user 1-2 simple steps to verify the app did not break.
- If they report an error, take responsibility, ask for the error log, and fix it immediately.
