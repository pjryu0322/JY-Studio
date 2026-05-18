/** @typedef {{ name: string; ok: boolean; note: string }} LiveE2eCheck */

export const EXPECTED_TIMELINE_STAGES = Object.freeze([
  "developer",
  "git",
  "review",
  "security",
  "approval",
  "scm",
  "completion",
]);

export function parseLiveE2eEnv(processEnv = process.env) {
  const env = (name, fallback = "") => String(processEnv[name] ?? fallback).trim();
  const envFlag = (name) => env(name) === "1" || env(name).toLowerCase() === "true";

  return {
    baseUrl: env("JYO_BASE_URL", "http://localhost:3000").replace(/\/$/, ""),
    projectId: env("JYO_PROJECT_ID"),
    taskId: env("JYO_TASK_ID"),
    sessionCookie: env("JYO_SESSION_COOKIE"),
    expectTimeline: envFlag("JYO_EXPECT_TIMELINE") || !processEnv.JYO_EXPECT_TIMELINE,
    doApprove: envFlag("JYO_APPROVE"),
    outputPath: env("JYO_OUTPUT_MD"),
  };
}

export function missingRequiredLiveE2eEnv(config) {
  const missing = [];
  if (!config.projectId) missing.push("JYO_PROJECT_ID");
  if (!config.taskId) missing.push("JYO_TASK_ID");
  if (!config.sessionCookie) missing.push("JYO_SESSION_COOKIE");
  return missing;
}

export function snapshotFromExecutionRunsResponse(json) {
  const run = json?.data?.[0] ?? null;
  return {
    run,
    teamRuntime: run?.teamRuntime ?? null,
    timeline: run?.teamRuntime?.timeline ?? null,
  };
}

export function stageStatusesFromTimeline(timeline) {
  if (!Array.isArray(timeline)) return {};
  return Object.fromEntries(timeline.map((t) => [t.stage ?? t.id, t.status]));
}

/**
 * @param {unknown} json
 * @param {{ expectTimeline?: boolean }} [options]
 * @returns {LiveE2eCheck[]}
 */
export function validateExecutionRunsResponse(json, options = {}) {
  const expectTimeline = options.expectTimeline !== false;
  /** @type {LiveE2eCheck[]} */
  const checks = [];
  const add = (name, ok, note = "") => checks.push({ name, ok, note });

  add("execution-runs success", json?.success === true, `success=${json?.success}`);
  const run = json?.data?.[0];
  add("data[0] exists", Boolean(run));
  add("teamRuntime exists", Boolean(run?.teamRuntime));

  const timeline = run?.teamRuntime?.timeline;
  if (expectTimeline) {
    add("timeline exists", Array.isArray(timeline));
    add("timeline length = 7", Array.isArray(timeline) && timeline.length === 7, `length=${timeline?.length ?? 0}`);

    if (Array.isArray(timeline) && timeline.length === 7) {
      const stages = timeline.map((t) => t.stage ?? t.id);
      const orderOk = stages.every((s, i) => s === EXPECTED_TIMELINE_STAGES[i]);
      add("stage order", orderOk, stages.join(" → "));
      for (const item of timeline) {
        const id = item.stage ?? item.id;
        add(`item ${id} has status`, Boolean(item.status), item.status ?? "");
        add(`item ${id} has titleKo`, Boolean(item.titleKo), item.titleKo ?? "");
      }
    }
  }

  const teamStatus = run?.teamExecutionStatus ?? run?.teamRuntime?.status;
  const stages = stageStatusesFromTimeline(timeline);
  if (teamStatus === "approval_waiting") {
    const ok = !stages.approval || stages.approval === "blocked";
    add("approval_waiting ↔ approval stage", ok, `approval=${stages.approval ?? "n/a"}`);
  }
  if (teamStatus === "merge_running") {
    const ok = stages.scm !== "pending";
    add("merge_running ↔ scm stage", ok, `scm=${stages.scm ?? "n/a"}`);
  }

  return checks;
}

/** @param {LiveE2eCheck[]} checks */
export function overallResultFromChecks(checks) {
  const failed = checks.filter((c) => !c.ok);
  if (failed.length === 0) return "PASS";
  if (failed.some((c) => c.name.includes("timeline") || c.name.startsWith("item "))) return "FAIL";
  return "PARTIAL";
}

/** @param {LiveE2eCheck[]} checks @param {string} name */
export function checkResult(checks, name) {
  return checks.find((c) => c.name === name);
}

export function timelineTableRows(timeline) {
  if (!Array.isArray(timeline)) return [];
  return timeline.map((item, i) => ({
    order: i + 1,
    stage: item.stage ?? item.id ?? "",
    titleKo: item.titleKo ?? "",
    status: item.status ?? "",
    summary: String(item.summaryKo ?? "").replace(/\|/g, "\\|").slice(0, 120),
  }));
}

export function buildLiveE2eEvidenceMarkdown(ctx) {
  const { baseUrl, projectId, taskId, git, checks, snapshot, approveSection, outputPath } = ctx;
  const run = snapshot.run;
  const team = snapshot.teamRuntime;
  const timeline = snapshot.timeline ?? [];
  const conclusion = overallResultFromChecks(checks);
  const passFail = (name) => (checkResult(checks, name)?.ok ? "PASS" : "FAIL");

  const apiRows = [
    ["execution-runs 응답", passFail("execution-runs success"), ""],
    ["data[0] 존재", passFail("data[0] exists"), ""],
    ["teamRuntime 존재", passFail("teamRuntime exists"), ""],
    ["timeline 존재", passFail("timeline exists"), ""],
    ["timeline length = 7", passFail("timeline length = 7"), ""],
    ["stage order", passFail("stage order"), ""],
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

export function createLiveE2eApiClient(config) {
  const { baseUrl, sessionCookie } = config;

  async function apiFetch(path, { method = "GET", body } = {}) {
    const headers = { Cookie: sessionCookie };
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
      const err = new Error(msg);
      err.code = msg.includes("ECONNREFUSED") || msg.includes("fetch failed") ? "ENV" : "NETWORK";
      throw err;
    }

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      const err = new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 500)}`);
      err.code = "PARSE";
      throw err;
    }

    return { res, json };
  }

  return {
    async fetchExecutionRuns(projectId, taskId) {
      const q = new URLSearchParams({ taskId, take: "1" });
      return apiFetch(`/api/projects/${encodeURIComponent(projectId)}/execution-runs?${q}`);
    },
    async approveAiTeamRuntime(taskId) {
      return apiFetch("/api/task/control", {
        method: "POST",
        body: { taskId, action: "workflow-approve-ai-team-runtime" },
      });
    },
  };
}

export function formatApproveEvidenceSection({
  approveOk,
  approveJson,
  beforeTeam,
  afterTeam,
  beforeStages,
  afterStages,
}) {
  return [
    "- JYO_APPROVE: 1",
    "- 실행 여부: yes",
    `- 결과: ${approveOk ? "success" : "failed"} (${JSON.stringify(approveJson)?.slice(0, 200)})`,
    `- 승인 전 teamRuntime.status: ${beforeTeam}`,
    `- 승인 후 teamRuntime.status: ${afterTeam}`,
    `- 승인 전 approval/scm status: approval=${beforeStages.approval ?? "—"}, scm=${beforeStages.scm ?? "—"}`,
    `- 승인 후 approval/scm status: approval=${afterStages.approval ?? "—"}, scm=${afterStages.scm ?? "—"}`,
  ].join("\n");
}
