# Contributing to Cubit Connect

Thank you for your interest in contributing to Cubit Connect! This document outlines the tools and processes we use to ensure code quality.

## 🛠️ Development Setup

1.  **Install Dependencies:**

    ```bash
    npm install
    ```

2.  **Run Development Server:**
    ```bash
    npm run dev
    ```

## 🧪 Testing

We use a combination of **Vitest** for unit testing and **Playwright** for end-to-end (E2E) testing.

### Unit Tests

Run unit tests for utility functions and hooks:

```bash
npm test
```

### End-to-End Tests

Run E2E tests to verify user flows (requires `npx serve` or running dev server):

```bash
npx playwright test
```

### Performance Benchmarks

Run Lighthouse audits:

```bash
npm run test:perf
```

## 🎨 Code Style

We use **Prettier** to enforce code formatting.

- **Check Formatting:** `npm run format:check`
- **Fix Formatting:** `npm run format`
- **Linting:** `npm run lint`
- **Type Checking:** `npm run type-check`

## 🚀 CI/CD

Our GitHub Actions pipeline (`.github/workflows/ci.yml`) automatically runs:

1.  Linting & Formatting Checks
2.  Type Checking
3.  Unit Tests
4.  E2E Tests (Desktop & Mobile)
5.  Security Audits
6.  Accessibility Scans

Please ensure all checks pass before submitting a Pull Request.

---

## 🔗 Sync System Contributions

When contributing to the synchronization system:

### Architecture Understanding

1. **Read the ADRs**: Check `docs/adr/` for architectural decisions
2. **Understand E2EE**: All sync data is encrypted - never log plaintext
3. **Error Handling**: Document all catch blocks with INTENTIONAL comments
4. **Testing**: New sync features require both unit and integration tests

### Sync Development Guidelines

#### Error Handling
```typescript
// ❌ Bad: Silent catch
try { ... } catch { }

// ✅ Good: Documented catch
try { ... } catch {
  // INTENTIONALLY HANDLING: Reason here
  console.error('...');
}
```

#### Security
- Never disable CSP headers for debugging
- Always use deriveSyncKey() for encryption keys
- Rate limiting is mandatory for new endpoints

#### Testing Requirements
```bash
# Run sync-specific tests
npx vitest run tests/unit/middleware/
npx vitest run tests/integration/supabaseSyncProd.test.ts

# Verify security headers
curl -I http://localhost:3000/api/health | grep -i security
```

### Sync Code Review Checklist

- [ ] Error handling documented
- [ ] Security headers verified
- [ ] Rate limiting considered
- [ ] Tests added for new functionality
- [ ] No plaintext logging
- [ ] E2EE maintained

---

*For detailed sync architecture, see [docs/API.md](./docs/API.md) and [docs/SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md)*
