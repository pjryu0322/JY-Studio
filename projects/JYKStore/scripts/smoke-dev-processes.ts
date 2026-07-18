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
assert.ok(
  dev.includes("dev:minio") &&
    dev.includes("dev:web") &&
    dev.includes("dev:worker") &&
    dev.includes("dev:search-worker"),
  "dev must run minio+web+docling+search-data workers",
);
assert.ok((pkg.scripts["dev:minio"] ?? "").includes("dev-minio"), "dev:minio starts local MinIO");
assert.ok((pkg.scripts["dev:web"] ?? "").includes("3004"), "web stays on 3004");
assert.ok((pkg.scripts["dev:worker"] ?? "").includes("docling-processing-worker"));
assert.ok(
  (pkg.scripts["dev:search-worker"] ?? "").includes("search-data-generation-worker"),
  "dev:search-worker must start search-data generation worker",
);
assert.ok(
  (pkg.scripts["worker:search-data"] ?? "").includes("search-data-generation-worker"),
  "worker:search-data must start search-data generation worker",
);

console.log("smoke:dev-processes OK");
console.log(
  "Manual check: npm run dev → Ctrl+C ends minio, web, docling worker, and search-data worker (no orphan).",
);
