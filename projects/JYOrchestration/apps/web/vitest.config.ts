import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/api/**/*.test.ts", "tests/overlay/**/*.test.ts"],
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    reporters: [
      "default",
      ["json", { outputFile: path.resolve(__dirname, "../../.artifacts/test-results/vitest-raw.json") }],
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@jy-orch": path.resolve(__dirname, "../../src"),
    },
  },
});
