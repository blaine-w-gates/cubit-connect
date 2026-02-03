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

## 🚀 CI/CD

Our GitHub Actions pipeline (`.github/workflows/ci.yml`) automatically runs:

1.  Linting & Formatting Checks
2.  Type Checking
3.  Unit Tests
4.  E2E Tests (Desktop & Mobile)
5.  Security Audits
6.  Accessibility Scans

Please ensure all checks pass before submitting a Pull Request.
