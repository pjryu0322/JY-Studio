#!/usr/bin/env node
/**
 * Level 3 AI Team Runtime live E2E evidence helper (CLI).
 * @see scripts/lib/ai-team-runtime-live-e2e-lib.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLiveE2eEvidenceMarkdown,
  createLiveE2eApiClient,
  formatApproveEvidenceSection,
  missingRequiredLiveE2eEnv,
  overallResultFromChecks,
  parseLiveE2eEnv,
  snapshotFromExecutionRunsResponse,
  stageStatusesFromTimeline,
  validateExecutionRunsResponse,
} from "./lib/ai-team-runtime-live-e2e-lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");
const JYO_ROOT = join(WEB_ROOT, "..", "..");
const DEFAULT_EVIDENCE_DIR = join(JYO_ROOT, "docs", "runtime", "evidence");

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function printUsage() {
  console.log(`Usage:
  JYO_PROJECT_ID=<id> JYO_TASK_ID=<id> JYO_SESSION_COOKIE='<cookie>' \\
    node scripts/ai-team-runtime-live-e2e-check.mjs

Optional:
  JYO_BASE_URL=http://localhost:3000
  JYO_APPROVE=1          # mutates task — prints WARNING first
  JYO_OUTPUT_MD=<path>   # default: docs/runtime/evidence/ai-team-runtime-live-e2e-<timestamp>.md
  JYO_EXPECT_TIMELINE=0  # skip timeline checks
`);
}

function formatTimestampForFile(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function tryGitMeta() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: JYO_ROOT,
      encoding: "utf8",
    }).trim();
    const commit = execSync("git rev-parse HEAD", { cwd: JYO_ROOT, encoding: "utf8" }).trim();
    return { branch, commit };
  } catch {
    return { branch: "(unknown)", commit: "(unknown)" };
  }
}

function printChecks(checks) {
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.note ? ` — ${c.note}` : ""}`);
  }
}

function assertHttpOk({ res, json }, label) {
  if (res.status === 401 || res.status === 403) {
    fail(`Session/RBAC issue (${label}): HTTP ${res.status} — check JYO_SESSION_COOKIE.`);
  }
  if (res.status >= 500) {
    fail(`API error (${label}): HTTP ${res.status} — ${JSON.stringify(json)?.slice(0, 400)}`);
  }
  if (!res.ok) {
    fail(`HTTP ${res.status} (${label}): ${JSON.stringify(json)?.slice(0, 400)}`);
  }
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const config = parseLiveE2eEnv();
  const missing = missingRequiredLiveE2eEnv(config);
  if (missing.length) {
    fail(
      `Missing required env: ${missing.join(", ")}\n` +
        "Set JYO_BASE_URL (default http://localhost:3000), JYO_PROJECT_ID, JYO_TASK_ID, JYO_SESSION_COOKIE.\n" +
        "Run with --help for usage."
    );
  }

  const client = createLiveE2eApiClient(config);
  const git = tryGitMeta();

  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Project: ${config.projectId}`);
  console.log(`Task: ${config.taskId}`);
  console.log(`Expect timeline: ${config.expectTimeline}`);
  console.log("");

  let snapshot;
  let checks;
  let approveSection = `- JYO_APPROVE: ${config.doApprove ? "1" : "0"}\n- 실행 여부: no\n`;

  try {
    const runs = await client.fetchExecutionRuns(config.projectId, config.taskId);
    assertHttpOk(runs, "execution-runs");
    snapshot = snapshotFromExecutionRunsResponse(runs.json);
    checks = validateExecutionRunsResponse(runs.json, { expectTimeline: config.expectTimeline });
  } catch (e) {
    if (e?.code === "ENV") {
      fail(`Environment issue: cannot reach ${config.baseUrl} (${e.message})`);
    }
    throw e;
  }

  printChecks(checks);

  if (config.doApprove) {
    console.log("\nWARNING: this will mutate task workflow status.\n");
    const beforeTeam = snapshot.teamRuntime?.status ?? "—";
    const beforeStages = stageStatusesFromTimeline(snapshot.timeline);

    const approve = await client.approveAiTeamRuntime(config.taskId);
    const approveOk = approve.res.ok && approve.json?.success === true;
    console.log(`Approve API: ${approveOk ? "PASS" : "FAIL"} HTTP ${approve.res.status}`);

    const runsAfter = await client.fetchExecutionRuns(config.projectId, config.taskId);
    assertHttpOk(runsAfter, "execution-runs (after approve)");
    snapshot = snapshotFromExecutionRunsResponse(runsAfter.json);
    checks = validateExecutionRunsResponse(runsAfter.json, { expectTimeline: config.expectTimeline });

    approveSection = formatApproveEvidenceSection({
      approveOk,
      approveJson: approve.json,
      beforeTeam,
      afterTeam: snapshot.teamRuntime?.status ?? "—",
      beforeStages,
      afterStages: stageStatusesFromTimeline(snapshot.timeline),
    });
  }

  const outputPath =
    config.outputPath ||
    join(DEFAULT_EVIDENCE_DIR, `ai-team-runtime-live-e2e-${formatTimestampForFile()}.md`);

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
