# Banned Patterns & Anti-Patterns

## Never Do These
1. Do not use console.log in production code -- use structured logger
2. Do not commit API keys or secrets (use environment variables)
3. Do not use eval() or equivalent dynamic execution
4. Do not write tests that depend on external APIs (mock them)
5. Do not leave TODO comments without a ticket reference
6. Do not loop through video timestamps synchronously -- use recursive function/queue waiting for video.onseeked
7. Do not use unscaled canvas images -- always downscale to max 640px
8. Do not use bare JSON.parse -- always wrap in try/catch, strip ```json fences
9. Do not double-execute AI calls -- use useRef lock or Zustand machine
10. Do not install unapproved dependencies without explicit permission
11. Do not refactor working code without explicit plan
12. Do not remove suppressHydrationWarning from html and body

## Suspicious Patterns to Flag
- Large try/catch blocks that catch generic Error
- Functions with > 5 parameters
- Classes with > 10 methods
- Files with > 10 imports (possible circular dependency)
- Closure variables in Playwright waitForFunction (pass args explicitly)
- Substring text selectors in Playwright (use exact match getByRole)
