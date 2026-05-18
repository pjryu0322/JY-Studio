#!/usr/bin/env node
/**
 * Scan local Live E2E evidence files (gitignored). Does not commit or upload content.
 * @see scripts/lib/ai-team-runtime-live-e2e-lib.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  defaultLiveE2eEvidenceDir,
  findSensitiveEvidenceLines,
  parseEvidenceConclusionFromMarkdown,
} from "./lib/ai-team-runtime-live-e2e-lib.mjs";

const DEFAULT_EVIDENCE_DIR = defaultLiveE2eEvidenceDir();

function listEvidenceFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".md") && name.startsWith("ai-team-runtime-live-e2e-"))
      .map((name) => {
        const path = join(dir, name);
        return { name, path, mtimeMs: statSync(path).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

function main() {
  const evidenceDir = (process.env.JYO_EVIDENCE_DIR ?? DEFAULT_EVIDENCE_DIR).trim();
  const files = listEvidenceFiles(evidenceDir);

  console.log(`Evidence directory: ${evidenceDir}`);
  console.log(`Evidence files: ${files.length}`);

  if (files.length === 0) {
    console.log("\nNo operator evidence found.");
    console.log("See docs/runtime/ai-team-runtime-level3-live-e2e-execution-only.md");
    console.log("Then: node scripts/ai-team-runtime-live-e2e-check.mjs");
    process.exit(0);
  }

  const latest = files[0];
  const content = readFileSync(latest.path, "utf8");
  const conclusion = parseEvidenceConclusionFromMarkdown(content);
  const sensitive = findSensitiveEvidenceLines(content);

  console.log(`\nLatest: ${latest.name}`);
  console.log(`Live E2E conclusion: ${conclusion ?? "(not found)"}`);
  console.log(`Sensitive pattern hits: ${sensitive.length}`);

  if (sensitive.length) {
    console.log("\nWARNING: possible secrets in evidence — do not commit this file.");
    for (const hit of sensitive.slice(0, 5)) {
      console.log(`  line ${hit.line}: ${hit.text}`);
    }
    if (sensitive.length > 5) console.log(`  ... and ${sensitive.length - 5} more`);
    console.log("\nGate: Level 3 next step BLOCKED until evidence is redacted and re-generated.");
    process.exit(1);
  } else {
    console.log("\nNo obvious sensitive patterns detected (manual review still recommended).");
  }

  console.log("\nNext: summarize into docs/runtime/ai-team-runtime-level3-manual-e2e.md (templates in execution-only §8).");
  console.log("Never commit docs/runtime/evidence/*.md");
  if (conclusion === "PASS") {
    console.log("Gate: evidence PASS — operator may update manual-e2e and proceed to TaskHistory integration (§9).");
  } else if (conclusion) {
    console.log(`Gate: evidence ${conclusion} — next step held per execution-only §9.`);
  }
}

main();
