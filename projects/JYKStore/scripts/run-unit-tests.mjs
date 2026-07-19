/**
 * Windows-safe unit test runner (avoids CreateProcess argv length limit).
 * File list: scripts/unit-test-files.json
 *
 * *.db.test.ts files are skipped unless JYKSTORE_DB_TESTS=1
 * (use npm run test:db:* for isolated DB suites).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const listed = JSON.parse(readFileSync(join(root, "scripts/unit-test-files.json"), "utf8"));

if (!Array.isArray(listed) || listed.length < 1) {
  console.error("scripts/unit-test-files.json must list test files");
  process.exit(1);
}

const includeDb = process.env.JYKSTORE_DB_TESTS === "1";
const files = includeDb
  ? listed
  : listed.filter((f) => !String(f).includes(".db.test."));

if (files.length < 1) {
  console.error("No unit test files to run");
  process.exit(1);
}

const BATCH = 40;
let failed = false;
for (let i = 0; i < files.length; i += BATCH) {
  const batch = files.slice(i, i + BATCH);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--test", ...batch],
    {
      cwd: root,
      stdio: "inherit",
      env: process.env,
      shell: false,
    },
  );
  if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
