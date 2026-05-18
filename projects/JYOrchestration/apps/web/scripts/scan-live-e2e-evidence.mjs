#!/usr/bin/env node
/**
 * Scan local Live E2E evidence files (gitignored). Does not commit or upload content.
 * @see scripts/lib/ai-team-runtime-live-e2e-lib.mjs
 */
import { formatScanLiveE2eReport, scanLiveE2eEvidence } from "./lib/ai-team-runtime-live-e2e-lib.mjs";

function main() {
  const report = formatScanLiveE2eReport(scanLiveE2eEvidence());
  for (const line of report.lines) console.log(line);
  process.exit(report.exitCode);
}

main();
