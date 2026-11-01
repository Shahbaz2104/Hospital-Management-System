import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    // Integration tests boot an in-memory MongoDB replica set and run
    // `prisma db push` against it, which is slow. Serial execution keeps CI
    // deterministic and avoids several replica sets competing for memory.
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    isolate: true,
    testTimeout: 120_000,
    hookTimeout: 180_000,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      reportsDirectory: "./coverage",
      // The full app is not under test yet; these thresholds guard the pure
      // logic layer that Phase 2 targets. Revisit once route coverage lands.
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
      include: [
        "lib/**/*.ts",
        "services/**/*.ts",
        "constants/**/*.ts",
        "validators/**/*.ts",
      ],
      exclude: ["lib/db.ts", "lib/env.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});