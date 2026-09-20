import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Mongo-backed suites share one database — run them sequentially.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});