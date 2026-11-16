import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Server tests only. The frontend has no tests yet; when it does, add a
// second project here with a DOM environment.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  test: {
    include: ['server/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['server/test/setup.ts'],
    coverage: {
      include: ['server/**/*.ts'],
      exclude: ['server/**/*.test.ts', 'server/test/**'],
    },
  },
});
