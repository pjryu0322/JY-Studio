import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  LIVE_E2E_FINAL_EXECUTION_DOC,
  buildLiveE2eEvidenceMarkdown,
  createLiveE2eApiClient,
  formatApproveEvidenceSection,
  formatLiveE2eCheckLines,
  formatMissingEnvMessage,
  formatScanLiveE2eReport,
  liveE2eHttpErrorMessage,
  missingRequiredLiveE2eEnv,
  overallResultFromChecks,
  parseLiveE2eEnv,
  readGitMetaForLiveE2e,
  resolveLiveE2eEvidenceDir,
  resolveLiveE2eOutputPath,
  scanLiveE2eEvidence,
  snapshotFromExecutionRunsResponse,
  stageStatusesFromTimeline,
  validateExecutionRunsResponse,
} from "./ai-team-runtime-live-e2e-lib.mjs";

export class LiveE2eCliError extends Error {
  /** @param {string} message @param {number} [exitCode] */
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "LiveE2eCliError";
    this.exitCode = exitCode;
  }
}

export function formatLiveE2eUsage() {
  return `Level 3 Live E2E evidence helper (operator-only; does not run Runtime).

Docs: projects/JYOrchestration/${LIVE_E2E_FINAL_EXECUTION_DOC}

Usage:
  JYO_PROJECT_ID=<id> JYO_TASK_ID=<id> JYO_SESSION_COOKIE='<cookie>' \\
    node scripts/ai-team-runtime-live-e2e-check.mjs

Optional:
  JYO_BASE_URL=http://localhost:3000
  JYO_APPROVE=1          # mutates task — prints WARNING first
  JYO_OUTPUT_MD=<path>   # default: docs/runtime/evidence/ai-team-runtime-live-e2e-<timestamp>.md
  JYO_EXPECT_TIMELINE=0  # skip timeline checks

After run: node scripts/scan-live-e2e-evidence.mjs
`;
}

async function fetchRunsValidated(client, projectId, taskId, expectTimeline, label) {
  const runs = await client.fetchExecutionRuns(projectId, taskId);
  const httpError = liveE2eHttpErrorMessage(runs, label);
  if (httpError) throw new LiveE2eCliError(httpError);

  return {
    snapshot: snapshotFromExecutionRunsResponse(runs.json),
    checks: validateExecutionRunsResponse(runs.json, { expectTimeline }),
  };
}

/**
 * @param {NodeJS.ProcessEnv} [processEnv]
 * @param {{ log?: (line: string) => void }} [options]
 */
export async function runLiveE2eEvidenceCheck(processEnv = process.env, options = {}) {
  const log = options.log ?? ((line) => console.log(line));

  const config = parseLiveE2eEnv(processEnv);
  const missing = missingRequiredLiveE2eEnv(config);
  if (missing.length) throw new LiveE2eCliError(formatMissingEnvMessage(missing));

  const client = createLiveE2eApiClient(config);
  const git = readGitMetaForLiveE2e();

  log(`Base URL: ${config.baseUrl}`);
  log(`Project: ${config.projectId}`);
  log(`Task: ${config.taskId}`);
  log(`Expect timeline: ${config.expectTimeline}`);
  log("");

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
      throw new LiveE2eCliError(`Environment issue: cannot reach ${config.baseUrl} (${e.message})`);
    }
    throw e;
  }

  for (const line of formatLiveE2eCheckLines(checks)) log(line);

  if (config.doApprove) {
    log("\nWARNING: this will mutate task workflow status.\n");
    const beforeTeam = snapshot.teamRuntime?.status ?? "—";
    const beforeStages = stageStatusesFromTimeline(snapshot.timeline);

    const approve = await client.approveAiTeamRuntime(config.taskId);
    const approveOk = approve.res.ok && approve.json?.success === true;
    log(`Approve API: ${approveOk ? "PASS" : "FAIL"} HTTP ${approve.res.status}`);

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

  const conclusion = overallResultFromChecks(checks);
  return {
    outputPath,
    checks,
    conclusion,
    exitCode: conclusion === "PASS" ? 0 : 2,
  };
}

/** @param {NodeJS.ProcessEnv} [processEnv] */
export function runScanLiveE2eEvidence(processEnv = process.env) {
  const evidenceDir = resolveLiveE2eEvidenceDir(processEnv);
  return formatScanLiveE2eReport(scanLiveE2eEvidence(evidenceDir));
}
