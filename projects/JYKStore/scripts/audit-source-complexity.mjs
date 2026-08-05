#!/usr/bin/env node
/**
 * P12.4 source complexity / SoT guards (text + simple scans).
 * Exit 1 on violation.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd());

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

function maxFunctionLoc(filePath) {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  let max = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*(export\s+)?(async\s+)?function\s+\w+/.test(lines[i])) continue;
    let depth = 0;
    let started = false;
    for (let j = i; j < lines.length; j++) {
      const opens = (lines[j].match(/\{/g) || []).length;
      const closes = (lines[j].match(/\}/g) || []).length;
      if (opens) started = true;
      depth += opens - closes;
      if (started && depth <= 0) {
        max = Math.max(max, j - i + 1);
        break;
      }
    }
  }
  return max;
}

const failures = [];

// 1) Worker max function LOC <= 150 (exclude known deferred? Prompt says Worker max <= 150)
const workerRoot = join(root, "src/lib/python-worker/worker-zip");
for (const file of walk(workerRoot)) {
  const max = maxFunctionLoc(file);
  if (max > 150) {
    failures.push(`Worker fn LOC ${max} > 150 in ${file.replace(root, "")}`);
  }
}

// 2) Rail presenter / rail / panel: no Gate imports
const gatePatterns = [
  "canPublish(",
  "canEnterServiceValidation",
  "canEnterGenerationWithScope",
  "resolveAdminWorkflowCurrentStep",
  "resolveAdminPublishGatePhase",
  "canRequestProviderReviewHandoff",
];
const sotFiles = [
  "src/lib/role-workspace/present-admin-review-rail.ts",
  "src/lib/role-workspace/present-next-admin-action.ts",
  "src/lib/role-workspace/admin-review-rail.ts",
  "src/components/AdminProviderReviewPanel.tsx",
];
for (const rel of sotFiles) {
  const src = readFileSync(join(root, rel), "utf8");
  for (const pat of gatePatterns) {
    // allow re-export alias of resolveAdminWorkflowStepQuery in rail
    if (pat === "resolveAdminWorkflowCurrentStep" && rel.includes("admin-review-rail.ts")) {
      if (src.includes("resolveAdminWorkflowCurrentStep(")) {
        failures.push(`${rel} still calls ${pat}`);
      }
      continue;
    }
    if (src.includes(pat)) {
      failures.push(`${rel} contains forbidden Gate token: ${pat}`);
    }
  }
}

if (failures.length) {
  console.error("P12.4 complexity audit FAILED:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("P12.4 complexity audit PASS");
process.exit(0);
