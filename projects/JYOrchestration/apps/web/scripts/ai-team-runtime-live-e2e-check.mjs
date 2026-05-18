#!/usr/bin/env node
/**
 * Level 3 AI Team Runtime live E2E evidence helper.
 * Reads execution-runs (and optionally approve API). Does NOT run Cursor, create tasks, or write DB.
 *
 * Usage (from apps/web):
 *   JYO_BASE_URL=http://localhost:3000 \
 *   JYO_PROJECT_ID=<projectId> \
 *   JYO_TASK_ID=<taskId> \
 *   JYO_SESSION_COOKIE='<cookie>' \
 *   node scripts/ai-team-runtime-live-e2e-check.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(__dirname, "..");
const JYO_ROOT = join(WEB_ROOT, "..", "..");
const DEFAULT_EVIDENCE_DIR = join(JYO_ROOT, "docs", "runtime", "evidence");

const EXPECTED_STAGES = [
  "developer",
  "git",
  "review",
  "security",
  "approval",
  "scm",
  "completion",
];

function env(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function envFlag(name) {
  return env(name) === "1" || env(name).toLowerCase() === "true";
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function checkRequiredEnv() {
  const missing = [];
  if (!env("JYO_PROJECT_ID")) missing.push("JYO_PROJECT_ID");
  if (!env("JYO_TASK_ID")) missing.push("JYO_TASK_ID");
  if (!env("JYO_SESSION_COOKIE")) missing.push("JYO_SESSION_COOKIE");
  if (missing.length) {
    fail(
      `Missing required env: ${missing.join(", ")}\n` +
        "Set JYO_BASE_URL (default http://localhost:3000), JYO_PROJECT_ID, JYO_TASK_ID, JYO_SESSION_COOKIE."
    );
  }
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

async function apiFetch(path, { method = "GET", body } = {}) {
  const baseUrl = env("JYO_BASE_URL", "http://localhost:3000").replace(/\/$/, "");
  const cookie = env("JYO_SESSION_COOKIE");
  const headers = { Cookie: cookie };
  if (body) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      fail(`Environment issue: cannot reach ${baseUrl} (${msg})`);
    }
    throw e;
  }

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    fail(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 500)}`);
  }

  return { res, json };
}

async function fetchExecutionRuns(projectId, taskId) {
  const q = new URLSearchParams({ taskId, take: "1" });
  const { res, json } = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/execution-runs?${q}`);

  if (res.status === 401 || res.status === 403) {
    fail(`Session/RBAC issue: HTTP ${res.status} — check JYO_SESSION_COOKIE and project access.`);
  }
  if (res.status >= 500) {
    fail(`API error: HTTP ${res.status} — ${JSON.stringify(json)?.slice(0, 400)}`);
  }
  if (!res.ok) {
    fail(`HTTP ${res.status}: ${JSON.stringify(json)?.slice(0, 400)}`);
  }

  return json;
}

function snapshotFromResponse(json) {
  const run = json?.data?.[0] ?? null;
  const teamRuntime = run?.teamRuntime ?? null;
  const timeline = teamRuntime?.timeline ?? null;
  return { run, teamRuntime, timeline };
}

function stageStatuses(timeline) {
  if (!Array.isArray(timeline)) return {};
  return Object.fromEntries(timeline.map((t) => [t.stage ?? t.id, t.status]));
}

function validateChecks(json) {
  const checks = [];
  const add = (name, ok, note = "") => checks.push({ name, ok, note });

  add("execution-runs success", json?.success === true, `success=${json?.success}`);
  const run = json?.data?.[0];
  add("data[0] exists", Boolean(run));
  add("teamRuntime exists", Boolean(run?.teamRuntime));
  const timeline = run?.teamRuntime?.timeline;
  add("timeline exists", Array.isArray(timeline));
  add("timeline length = 7", Array.isArray(timeline) && timeline.length === 7, `length=${timeline?.length ?? 0}`);

  if (Array.isArray(timeline) && timeline.length === 7) {
    const stages = timeline.map((t) => t.stage ?? t.id);
    const orderOk = stages.every((s, i) => s === EXPECTED_STAGES[i]);
    add("stage order", orderOk, stages.join(" → "));
    for (const item of timeline) {
      const id = item.stage ?? item.id;
      add(`item ${id} has status`, Boolean(item.status), item.status ?? "");
      add(`item ${id} has titleKo`, Boolean(item.titleKo), item.titleKo ?? "");
    }
  }

  const teamStatus = run?.teamExecutionStatus ?? run?.teamRuntime?.status;
  const stages = stageStatuses(timeline);
  if (teamStatus === "approval_waiting" && stages.approval && stages.approval !== "blocked") {
    add("approval_waiting ↔ approval stage", false, `approval=${stages.approval}`);
  } else if (teamStatus === "approval_waiting") {
    add("approval_waiting ↔ approval stage", true, `approval=${stages.approval ?? "n/a"}`);
  }
  if (teamStatus === "merge_running" && stages.scm === "pending") {
    add("merge_running ↔ scm stage", false, `scm=${stages.scm}`);
  } else if (teamStatus === "merge_running") {
    add("merge_running ↔ scm stage", true, `scm=${stages.scm ?? "n/a"}`);
  }

  return checks;
}

function overallFromChecks(checks) {
  const failed = checks.filter((c) => !c.ok);
  if (failed.length === 0) return "PASS";
  const onlyEnv = failed.every((c) => c.name.includes("Environment"));
  return onlyEnv ? "FAIL" : failed.some((c) => c.name.includes("timeline")) ? "FAIL" : "PARTIAL";
}

function printChecks(checks) {
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.note ? ` — ${c.note}` : ""}`);
  }
}

function timelineTableRows(timeline) {
  if (!Array.isArray(timeline)) return [];
  return timeline.map((item, i) => ({
    order: i + 1,
    stage: item.stage ?? item.id ?? "",
    titleKo: item.titleKo ?? "",
    status: item.status ?? "",
    summary: (item.summaryKo ?? "").replace(/\|/g, "\\|").slice(0, 120),
  }));
}

function buildEvidenceMarkdown(ctx) {
  const { baseUrl, projectId, taskId, git, checks, snapshot, approveSection, outputPath } = ctx;
  const run = snapshot.run;
  const team = snapshot.teamRuntime;
  const timeline = snapshot.timeline ?? [];
  const conclusion = overallFromChecks(checks);

  const apiRows = [
    ["execution-runs 응답", checks.find((c) => c.name === "execution-runs success")?.ok ? "PASS" : "FAIL", ""],
    ["data[0] 존재", checks.find((c) => c.name === "data[0] exists")?.ok ? "PASS" : "FAIL", ""],
    ["teamRuntime 존재", checks.find((c) => c.name === "teamRuntime exists")?.ok ? "PASS" : "FAIL", ""],
    ["timeline 존재", checks.find((c) => c.name === "timeline exists")?.ok ? "PASS" : "FAIL", ""],
    [
      "timeline length = 7",
      checks.find((c) => c.name === "timeline length = 7")?.ok ? "PASS" : "FAIL",
      "",
    ],
    ["stage order", checks.find((c) => c.name === "stage order")?.ok ? "PASS" : "FAIL", ""],
  ];

  const timelineRows = timelineTableRows(timeline)
    .map((r) => `| ${r.order} | ${r.stage} | ${r.titleKo} | ${r.status} | ${r.summary} |`)
    .join("\n");

  return `# AI Team Execution Runtime Live E2E Evidence

## 기준

- Date: ${new Date().toISOString()}
- Base URL: ${baseUrl}
- Project ID: ${projectId}
- Task ID: ${taskId}
- Branch: ${git.branch}
- Commit: ${git.commit}
- Evidence file: ${outputPath}

## API 확인

| 항목 | 결과 | 비고 |
|---|---|---|
${apiRows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`).join("\n")}

## Runtime 상태

- run.status: ${run?.status ?? "—"}
- teamExecutionStatus: ${run?.teamExecutionStatus ?? "—"}
- teamRuntime.status: ${team?.status ?? "—"}
- executionWorkflowStatus: (task context not in this API — check Task row separately)
- branchName: ${run?.branchName ?? "—"}
- commitSha: ${run?.commitSha ?? "—"}
- prStatus: ${run?.prStatus ?? "—"}
- blockReason: ${team?.blockReason ?? "—"}

## Timeline

| 순서 | stage | titleKo | status | summary |
|---:|---|---|---|---|
${timelineRows || "| — | — | — | — | — |"}

## 승인 API 실행

${approveSection}

## 결론

- Live E2E 결과: **${conclusion}**
- 실패 사유: ${checks.filter((c) => !c.ok).map((c) => c.name).join(", ") || "—"}
- 다음 조치: ${conclusion === "PASS" ? "Manual E2E 문서 갱신 후 Level 3 다음 단계 검토" : "환경·session·run 상태 확인 후 재실행"}
`;
}

async function main() {
  checkRequiredEnv();

  const projectId = env("JYO_PROJECT_ID");
  const taskId = env("JYO_TASK_ID");
  const baseUrl = env("JYO_BASE_URL", "http://localhost:3000");
  const expectTimeline = envFlag("JYO_EXPECT_TIMELINE") || true;
  const doApprove = envFlag("JYO_APPROVE");
  const git = tryGitMeta();

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Project: ${projectId}`);
  console.log(`Task: ${taskId}`);
  console.log(`Expect timeline: ${expectTimeline}`);
  console.log("");

  const jsonBefore = await fetchExecutionRuns(projectId, taskId);
  const snapshotBefore = snapshotFromResponse(jsonBefore);
  let checks = validateChecks(jsonBefore);
  printChecks(checks);

  let approveSection = `- JYO_APPROVE: ${doApprove ? "1" : "0"}\n- 실행 여부: no\n`;

  if (doApprove) {
    console.log("\nWARNING: this will mutate task workflow status.\n");
    const beforeTeam = snapshotBefore.teamRuntime?.status ?? "—";
    const beforeStages = stageStatuses(snapshotBefore.timeline);

    const { res, json } = await apiFetch("/api/task/control", {
      method: "POST",
      body: { taskId, action: "workflow-approve-ai-team-runtime" },
    });

    const approveOk = res.ok && json?.success === true;
    console.log(`Approve API: ${approveOk ? "PASS" : "FAIL"} HTTP ${res.status}`);

    const jsonAfter = await fetchExecutionRuns(projectId, taskId);
    const snapshotAfter = snapshotFromResponse(jsonAfter);
    const afterTeam = snapshotAfter.teamRuntime?.status ?? "—";
    const afterStages = stageStatuses(snapshotAfter.timeline);

    approveSection = [
      `- JYO_APPROVE: 1`,
      `- 실행 여부: yes`,
      `- 결과: ${approveOk ? "success" : "failed"} (${JSON.stringify(json)?.slice(0, 200)})`,
      `- 승인 전 teamRuntime.status: ${beforeTeam}`,
      `- 승인 후 teamRuntime.status: ${afterTeam}`,
      `- 승인 전 approval/scm status: approval=${beforeStages.approval ?? "—"}, scm=${beforeStages.scm ?? "—"}`,
      `- 승인 후 approval/scm status: approval=${afterStages.approval ?? "—"}, scm=${afterStages.scm ?? "—"}`,
    ].join("\n");

    checks = validateChecks(jsonAfter);
    snapshotBefore.run = snapshotAfter.run;
    snapshotBefore.teamRuntime = snapshotAfter.teamRuntime;
    snapshotBefore.timeline = snapshotAfter.timeline;
  }

  const outputPath =
    env("JYO_OUTPUT_MD") ||
    join(DEFAULT_EVIDENCE_DIR, `ai-team-runtime-live-e2e-${formatTimestampForFile()}.md`);

  mkdirSync(dirname(outputPath), { recursive: true });
  const md = buildEvidenceMarkdown({
    baseUrl,
    projectId,
    taskId,
    git,
    checks,
    snapshot: snapshotBefore,
    approveSection,
    outputPath,
  });
  writeFileSync(outputPath, md, "utf8");
  console.log(`\nEvidence written: ${outputPath}`);

  const conclusion = overallFromChecks(checks);
  if (conclusion !== "PASS") process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
