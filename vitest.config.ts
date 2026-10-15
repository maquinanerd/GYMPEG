import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // plugin-react transforms JSX/TSX in test files regardless of the
  // tsconfig `jsx: preserve` setting used by Next.js.
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    // Logic tests live next to lib/ code, component tests under components/.
    include: ['lib/**/*.test.ts', 'components/**/*.test.{ts,tsx}'],
    // jsdom covers both: pure logic tests run fine in it too.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // user-event waits on a timer after every keystroke, and Node's timers are
    // much coarser on Windows: a form test that types a few passwords takes
    // seconds there and fractions of one on Linux. The local CI runs on
    // Windows, so it gets more room; Linux keeps Vitest's 5 s default.
    testTimeout: process.platform === 'win32' ? 20_000 : 5_000,
  },
});
