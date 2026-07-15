/**
 * Manual / CI smoke checklist for npm run dev process coupling.
 * Automated process-tree killing is environment-dependent on Windows;
 * this script documents and lightly validates concurrently flags.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

const dev = pkg.scripts.dev ?? "";
assert.ok(dev.includes("concurrently"), "dev must use concurrently");
assert.ok(/\s-k(\s|"|$)/.test(` ${dev} `) || dev.includes("--kill-others"), "dev must kill others (-k)");
assert.ok(dev.includes("--success first"), "dev must exit when first child exits");
assert.ok(dev.includes("dev:web") && dev.includes("dev:worker"), "dev must run web+worker");
assert.ok((pkg.scripts["dev:web"] ?? "").includes("3004"), "web stays on 3004");
assert.ok((pkg.scripts["dev:worker"] ?? "").includes("docling-processing-worker"));

console.log("smoke:dev-processes OK");
console.log("Manual check: npm run dev → Ctrl+C ends both web and worker (no orphan).");
