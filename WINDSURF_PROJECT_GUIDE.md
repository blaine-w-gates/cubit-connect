# Windsurf/Cascade Project Preparation Guide

> **Purpose:** A comprehensive guide for preparing your project before building with Cascade in Windsurf. Share this with Gemini Pro to align on project requirements and ensure optimal AI-assisted development.

---

## Table of Contents
1. [Pre-Project Planning](#1-pre-project-planning)
2. [Project Documentation Structure](#2-project-documentation-structure)
3. [Context & Memory Management](#3-context--memory-management)
4. [Rate Limits & Token Optimization](#4-rate-limits--token-optimization)
5. [Debugging Best Practices](#5-debugging-best-practices)
6. [Security Considerations](#6-security-considerations)
7. [Accuracy & Focus Strategies](#7-accuracy--focus-strategies)
8. [Configuration Files](#8-configuration-files)
9. [Discussion Topics for Your Project](#9-discussion-topics-for-your-project)

---

## 1. Pre-Project Planning

### Create a Product Requirements Document (PRD)
Before writing any code, define your project completely:

- **Problem Statement:** What problem does this solve? Who experiences it?
- **Target Users:** Define your primary and secondary user personas
- **Core Features:** List MVP features vs. nice-to-haves
- **Technical Constraints:** Platform, performance requirements, integrations
- **Success Metrics:** How will you measure if the product works?

### Plan Before Implementation
> "Use Ask Mode to plan. Use state-of-the-art models for planning (like o3), then switch to Agent Mode with a thinking model (Gemini 2.5 Pro) to implement."

**Why planning first matters:**
- Planning is the hardest part—implementation is easier with a good plan
- Better to throw away a bad plan than a bad implementation
- SOTA models cost more—use expensive tokens for planning, cheaper ones for execution
- Reduces hallucinations and scope creep

### Break Down Into Small Tasks
Big projects overwhelm AI. Structure work into:
- **Autonomously completable tasks** (one feature, one function, one component)
- **Clear acceptance criteria** for each task
- **Dependencies mapped** between tasks

Example: Instead of "Build the entire app," use "Create the User model with email, password hash, and timestamps."

---

## 2. Project Documentation Structure

### Recommended File Structure
```
project/
├── docs/
│   ├── product_requirement_docs.md    # PRD - Source of truth
│   ├── architecture.md                 # System design & components
│   └── technical.md                    # Tech stack, patterns, constraints
├── tasks/
│   ├── tasks_plan.md                   # Task backlog & progress
│   ├── active_context.md               # Current focus & next steps
│   └── rfc/                            # Design proposals
├── .windsurfrules                      # Project-specific AI rules
├── .cursor/rules/
│   ├── error-documentation.mdc         # Known issues & fixes
│   └── lessons-learned.mdc             # Patterns & preferences
└── README.md
```

### Core Documentation Files

| File | Purpose |
|------|---------|
| `product_requirement_docs.md` | Defines purpose, problems solved, requirements, goals |
| `architecture.md` | System design, component relationships, dependencies |
| `technical.md` | Tech stack, design patterns, technical constraints |
| `tasks_plan.md` | Task backlog, progress tracking, known issues |
| `active_context.md` | Current development focus, recent changes, next steps |

---

## 3. Context & Memory Management

### Understanding Context Windows
- **Context window** = AI's "working memory" (measured in tokens)
- Models have limits: GPT-4 ~32K, Claude 3.5 ~200K, Gemini ~1M
- **More context ≠ better results**—focused context is better

### Best Practices

**Start New Chats Frequently**
- Switch to a new chat after completing each task
- Prevents context pollution from previous work
- Improves accuracy and reduces hallucinations
- Makes history easier to review

**Provide Focused Context**
- Only include relevant files/code in prompts
- Use screenshots sparingly (they consume many tokens)
- Reference specific line numbers and file paths
- Summarize long documents before including

**Leverage Memory Systems**
- Use `.windsurfrules` for project-specific context
- Maintain `active_context.md` for current state
- Document decisions in `lessons-learned.mdc`

### Context Hierarchy
```
1. System prompt (always loaded)
2. Global rules (universal standards)
3. Project rules (.windsurfrules)
4. Current file context
5. User prompt
```

---

## 4. Rate Limits & Token Optimization

### Token-Saving Strategies

**Minimize Output Requests**
- Ask for specific solutions, not explanations
- Request "code only" when you just need implementation
- Avoid asking for multiple alternatives

**Efficient Prompting**
- Be specific—vague prompts require back-and-forth
- Include error messages directly, don't describe them
- Use structured formats (JSON, bullet points)

**Batch Related Requests**
- Group related changes into single prompts
- Plan multi-file changes before starting

**Avoid Repeated Context**
- Don't re-explain project setup each time
- Reference documentation files instead
- Use project rules files for consistent instructions

### When Hitting Rate Limits
1. Wait for the cooldown period
2. Use the time to review/test generated code
3. Plan next steps while waiting
4. Consider switching to a different model tier

---

## 5. Debugging Best Practices

### The 5-Phase Debugging Workflow

1. **Requirements & Clarification**
   - What is the expected behavior?
   - What is the actual behavior?
   - Can you reproduce it consistently?

2. **Exhaustive Search**
   - Check error logs and stack traces
   - Identify all possible causes
   - Don't jump to the first solution

3. **User Validation**
   - Confirm the fix approach before implementing
   - State assumptions clearly
   - Get approval on breaking changes

4. **Implementation**
   - Fix one issue at a time
   - Test thoroughly before moving on
   - Keep changes minimal

5. **Prevention**
   - Document the fix in error-documentation
   - Add regression tests
   - Consider if similar bugs exist elsewhere

### Debugging Rules

- **Address root cause, not symptoms**
- **Add logging before changing logic**
- **Never delete tests to make them pass**
- **Paste actual error messages, not descriptions**
- **Use the smallest reproducible example**

### When AI Can't Fix It
- Try a different model (switch from fast to thinking model)
- Explain why the previous fix didn't work
- Break the problem down further
- Manually debug to isolate the issue

---

## 6. Security Considerations

### Never Hardcode Secrets
```javascript
// ❌ BAD
const API_KEY = "sk-1234567890abcdef";

// ✅ GOOD
const API_KEY = process.env.API_KEY;
```

### Environment Variables
- Use `.env` files for local development
- Add `.env` to `.gitignore` immediately
- Document required env vars in `.env.example`
- Use secret managers in production

### Security Checklist
- [ ] All API keys in environment variables
- [ ] `.env` files in `.gitignore`
- [ ] Input validation on all user data
- [ ] SQL parameterized queries (prevent injection)
- [ ] Authentication on sensitive endpoints
- [ ] HTTPS for all external communications
- [ ] Rate limiting on public APIs
- [ ] Dependency vulnerability scanning

### AI Security Reminders
- Never share real credentials in prompts
- Review AI-generated auth code carefully
- Test permission boundaries manually
- Don't trust AI for cryptographic implementations

---

## 7. Accuracy & Focus Strategies

### Improve AI Accuracy

**Be Specific in Prompts**
```
// ❌ Vague
"Fix the login bug"

// ✅ Specific
"The login form at /auth/login returns 401 even with correct credentials. 
Error: 'Invalid token'. Check the JWT verification in auth.middleware.js"
```

**Use Structured Prompts**
```markdown
**Task:** [What you want done]
**Context:** [Relevant background]
**Files:** [Specific files involved]
**Constraints:** [Requirements/limitations]
**Expected Output:** [What success looks like]
```

**Provide Examples**
- Show working code as reference
- Include expected input/output
- Reference similar patterns in codebase

### Maintain Focus

**One Task Per Chat**
- Complete a task fully before starting another
- Don't context-switch mid-implementation
- Document progress before switching

**Use Checkpoints**
- Commit working code frequently
- Tag stable versions
- Don't be afraid to rollback

**Test Early and Often**
- Write tests alongside features
- Validate assumptions immediately
- Catch bugs when context is fresh

---

## 8. Configuration Files

### `.windsurfrules` Template
Create this file in your project root:

```markdown
# Project: [Your Project Name]

## Overview
[1-2 sentence description of what this project does]

## Tech Stack
- Frontend: [e.g., React, Next.js, TailwindCSS]
- Backend: [e.g., Node.js, Express, Supabase]
- Database: [e.g., PostgreSQL, Supabase]
- Deployment: [e.g., Vercel, Netlify]

## Project Structure
[Brief description of key directories]

## Coding Standards
- [Your language/framework conventions]
- [Naming conventions]
- [File organization rules]

## Key Patterns
- [Authentication approach]
- [State management]
- [API structure]

## Current Focus
[What you're actively working on]

## Known Issues
[Any gotchas or workarounds]
```

### Global Rules (Windsurf Settings)
Set these in Windsurf preferences for all projects:
- Code style preferences
- Language/framework defaults
- Testing requirements
- Documentation standards

---

## 9. Discussion Topics for Your Project

Use these questions to prepare your conversation with Gemini Pro:

### Product Definition
- [ ] What specific problem does this solve?
- [ ] Who is the primary user? Secondary users?
- [ ] What are the 3-5 core features for MVP?
- [ ] What features are explicitly out of scope?
- [ ] What does success look like? How will you measure it?

### Technical Architecture
- [ ] What tech stack will you use and why?
- [ ] What are the main data entities/models?
- [ ] How will users authenticate?
- [ ] What external services/APIs are needed?
- [ ] How will you handle real-time updates (if needed)?
- [ ] What's the deployment strategy?

### User Experience
- [ ] What are the primary user flows?
- [ ] What screens/pages are needed?
- [ ] Mobile-first or desktop-first?
- [ ] Accessibility requirements?

### Data & Security
- [ ] What data will you store?
- [ ] What are the privacy requirements?
- [ ] Who can access what data?
- [ ] Backup and recovery strategy?

### Development Process
- [ ] What's the priority order for features?
- [ ] How will you test the application?
- [ ] What are the known technical risks?
- [ ] What integrations are critical vs. nice-to-have?

### Constraints
- [ ] Timeline/deadline?
- [ ] Budget constraints?
- [ ] Team size and skills?
- [ ] Technical limitations?

---

## Quick Reference Checklist

### Before Starting
- [ ] PRD document created
- [ ] Architecture planned
- [ ] Tech stack decided
- [ ] `.windsurfrules` configured
- [ ] Environment variables documented
- [ ] Task breakdown complete

### During Development
- [ ] New chat for each task
- [ ] Commit working code frequently
- [ ] Test as you build
- [ ] Document decisions
- [ ] Keep context focused

### For Each Feature
- [ ] Clear requirements defined
- [ ] Approach validated before coding
- [ ] Tests written alongside code
- [ ] Edge cases considered
- [ ] Security reviewed

---

## Resources

- [Vibe Coding AI Rules](https://github.com/obviousworks/vibe-coding-ai-rules)
- [Rules Template](https://github.com/Bhartendu-Kumar/rules_template)
- [Cursor Directory](https://cursor.directory/rules)
- [Anthropic Prompting Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)

---

*Last updated: December 2024*
