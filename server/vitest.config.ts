import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.integration.test.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
