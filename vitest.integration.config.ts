import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    silent: true,
    reporters: ['dot'],
    environment: 'jsdom',
    globals: true,
    dangerouslyIgnoreUnhandledErrors: true, // jsdom throws UND_ERR_INVALID_ARG on aborted fetches
    setupFiles: ['./tests/integration/setup.ts'],
    include: ['tests/integration/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'tests/e2e/**/*', 'tests/*.spec.ts', 'dist', '.next'],
    testTimeout: 60000,
  },
});
