#!/usr/bin/env node
/**
 * Level 3 AI Team Runtime live E2E evidence helper (CLI).
 * @see scripts/lib/ai-team-runtime-live-e2e-runner.mjs
 */
import {
  LiveE2eCliError,
  formatLiveE2eUsage,
  runLiveE2eEvidenceCheck,
} from "./lib/ai-team-runtime-live-e2e-runner.mjs";

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(formatLiveE2eUsage());
    return;
  }

  const result = await runLiveE2eEvidenceCheck();
  console.log(`\nEvidence written: ${result.outputPath}`);
  if (result.exitCode !== 0) process.exit(result.exitCode);
}

main().catch((e) => {
  if (e instanceof LiveE2eCliError) {
    console.error(e.message);
    process.exit(e.exitCode);
  }
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
