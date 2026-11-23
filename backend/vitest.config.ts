import { defineConfig } from 'vitest/config';

export default defineConfig({
  ssr: {
    noExternal: ['node:sqlite'],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/modules/**/*.ts',
        'src/lib/**/*.ts',
        'src/db/repositories/**/*.ts',
      ],
      exclude: ['**/*.d.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 60,
      },
    },
  },
});
