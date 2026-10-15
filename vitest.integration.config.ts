import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Integration tests run against a real Postgres (see docker-compose.test.yml).
// Kept separate from the unit/component config (jsdom).
//
// The suites truncate tables, so DATABASE_URL is always forced to the test
// database (INTEGRATION_DATABASE_URL when set), never inherited from a dev
// shell or .env. Set here rather than as a `VAR=value` prefix in the npm
// script, which cmd.exe (the local CI on Windows) cannot run.
const TEST_DB =
  process.env.INTEGRATION_DATABASE_URL ??
  'postgresql://gymcoach_test:gymcoach_test@localhost:5434/gymcoach_test';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    env: { DATABASE_URL: TEST_DB },
    setupFiles: ['tests/integration/setup.ts'],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
