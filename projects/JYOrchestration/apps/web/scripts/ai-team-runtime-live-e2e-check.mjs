#!/usr/bin/env node
/**
 * Level 3 AI Team Runtime live E2E evidence helper (CLI).
 * @see scripts/lib/ai-team-runtime-live-e2e-lib.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  LIVE_E2E_EXECUTION_ONLY_DOC,
  buildLiveE2eEvidenceMarkdown,
  createLiveE2eApiClient,
  formatApproveEvidenceSection,
  formatLiveE2eCheckLines,
  formatMissingEnvMessage,
  liveE2eHttpErrorMessage,
  missingRequiredLiveE2eEnv,
  overallResultFromChecks,
  parseLiveE2eEnv,
  readGitMetaForLiveE2e,
  resolveLiveE2eOutputPath,
  snapshotFromExecutionRunsResponse,
  stageStatusesFromTimeline,
  validateExecutionRunsResponse,
} from "./lib/ai-team-runtime-live-e2e-lib.mjs";

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function printUsage() {
  console.log(`Level 3 Live E2E evidence helper (operator-only; does not run Runtime).

Docs: projects/JYOrchestration/${LIVE_E2E_EXECUTION_ONLY_DOC}

Usage:
  JYO_PROJECT_ID=<id> JYO_TASK_ID=<id> JYO_SESSION_COOKIE='<cookie>' \\
    node scripts/ai-team-runtime-live-e2e-check.mjs

Optional:
  JYO_BASE_URL=http://localhost:3000
  JYO_APPROVE=1          # mutates task — prints WARNING first
  JYO_OUTPUT_MD=<path>   # default: docs/runtime/evidence/ai-team-runtime-live-e2e-<timestamp>.md
  JYO_EXPECT_TIMELINE=0  # skip timeline checks

After run: node scripts/scan-live-e2e-evidence.mjs
`);
}

function assertHttpOk(payload, label) {
  const message = liveE2eHttpErrorMessage(payload, label);
  if (message) fail(message);
}

async function fetchRunsValidated(client, projectId, taskId, expectTimeline, label) {
  const runs = await client.fetchExecutionRuns(projectId, taskId);
  assertHttpOk(runs, label);
  return {
    snapshot: snapshotFromExecutionRunsResponse(runs.json),
    checks: validateExecutionRunsResponse(runs.json, { expectTimeline }),
  };
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const config = parseLiveE2eEnv();
  const missing = missingRequiredLiveE2eEnv(config);
  if (missing.length) fail(formatMissingEnvMessage(missing));

  const client = createLiveE2eApiClient(config);
  const git = readGitMetaForLiveE2e();

  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Project: ${config.projectId}`);
  console.log(`Task: ${config.taskId}`);
  console.log(`Expect timeline: ${config.expectTimeline}`);
  console.log("");

  let approveSection = `- JYO_APPROVE: ${config.doApprove ? "1" : "0"}\n- 실행 여부: no\n`;

  let snapshot;
  let checks;

  try {
    ({ snapshot, checks } = await fetchRunsValidated(
      client,
      config.projectId,
      config.taskId,
      config.expectTimeline,
      "execution-runs"
    ));
  } catch (e) {
    if (e?.code === "ENV") {
      fail(`Environment issue: cannot reach ${config.baseUrl} (${e.message})`);
    }
    throw e;
  }

  for (const line of formatLiveE2eCheckLines(checks)) console.log(line);

  if (config.doApprove) {
    console.log("\nWARNING: this will mutate task workflow status.\n");
    const beforeTeam = snapshot.teamRuntime?.status ?? "—";
    const beforeStages = stageStatusesFromTimeline(snapshot.timeline);

    const approve = await client.approveAiTeamRuntime(config.taskId);
    const approveOk = approve.res.ok && approve.json?.success === true;
    console.log(`Approve API: ${approveOk ? "PASS" : "FAIL"} HTTP ${approve.res.status}`);

    ({ snapshot, checks } = await fetchRunsValidated(
      client,
      config.projectId,
      config.taskId,
      config.expectTimeline,
      "execution-runs (after approve)"
    ));

    approveSection = formatApproveEvidenceSection({
      approveOk,
      approveJson: approve.json,
      beforeTeam,
      afterTeam: snapshot.teamRuntime?.status ?? "—",
      beforeStages,
      afterStages: stageStatusesFromTimeline(snapshot.timeline),
    });
  }

  const outputPath = resolveLiveE2eOutputPath(config);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    buildLiveE2eEvidenceMarkdown({
      baseUrl: config.baseUrl,
      projectId: config.projectId,
      taskId: config.taskId,
      git,
      checks,
      snapshot,
      approveSection,
      outputPath,
    }),
    "utf8"
  );
  console.log(`\nEvidence written: ${outputPath}`);

  if (overallResultFromChecks(checks) !== "PASS") process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
