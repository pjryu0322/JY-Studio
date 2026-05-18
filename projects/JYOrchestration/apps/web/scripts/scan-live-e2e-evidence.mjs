#!/usr/bin/env node
/**
 * Scan local Live E2E evidence files (gitignored). Does not commit or upload content.
 * @see scripts/lib/ai-team-runtime-live-e2e-runner.mjs
 */
import { runScanLiveE2eEvidence } from "./lib/ai-team-runtime-live-e2e-runner.mjs";

const report = runScanLiveE2eEvidence();
for (const line of report.lines) console.log(line);
process.exit(report.exitCode);
