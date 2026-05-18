#!/usr/bin/env node
/**
 * Scan local Live E2E evidence files (gitignored). Does not commit or upload content.
 * @see scripts/lib/ai-team-runtime-live-e2e-lib.mjs
 */
import {
  LIVE_E2E_EXECUTION_ONLY_DOC,
  scanLiveE2eEvidence,
} from "./lib/ai-team-runtime-live-e2e-lib.mjs";

function main() {
  const result = scanLiveE2eEvidence();

  console.log(`Evidence directory: ${result.evidenceDir}`);
  console.log(`Evidence files: ${result.files.length}`);

  if (!result.latest) {
    console.log("\nNo operator evidence found.");
    console.log(`See ${LIVE_E2E_EXECUTION_ONLY_DOC}`);
    console.log("Then: node scripts/ai-team-runtime-live-e2e-check.mjs");
    process.exit(0);
  }

  console.log(`\nLatest: ${result.latest.name}`);
  console.log(`Live E2E conclusion: ${result.conclusion ?? "(not found)"}`);
  console.log(`Sensitive pattern hits: ${result.sensitive.length}`);

  if (result.sensitive.length) {
    console.log("\nWARNING: possible secrets in evidence — do not commit this file.");
    for (const hit of result.sensitive.slice(0, 5)) {
      console.log(`  line ${hit.line}: ${hit.text}`);
    }
    if (result.sensitive.length > 5) {
      console.log(`  ... and ${result.sensitive.length - 5} more`);
    }
    console.log("\nGate: Level 3 next step BLOCKED until evidence is redacted and re-generated.");
    process.exit(1);
  }

  console.log("\nNo obvious sensitive patterns detected (manual review still recommended).");
  console.log("\nNext: summarize into docs/runtime/ai-team-runtime-level3-manual-e2e.md (templates in execution-only §8).");
  console.log("Never commit docs/runtime/evidence/*.md");

  if (result.conclusion === "PASS") {
    console.log("Gate: evidence PASS — operator may update manual-e2e and proceed to TaskHistory integration (§9).");
  } else if (result.conclusion) {
    console.log(`Gate: evidence ${result.conclusion} — next step held per execution-only §9.`);
  }
}

main();
