import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const _LIB_DIR = dirname(fileURLToPath(import.meta.url));

export const LIVE_E2E_EVIDENCE_FILENAME_PREFIX = "ai-team-runtime-live-e2e-";

export const LIVE_E2E_FINAL_EXECUTION_DOC =
  "docs/runtime/ai-team-runtime-level3-final-live-e2e-execution.md";

/** @typedef {{ name: string; ok: boolean; note: string }} LiveE2eCheck */
/** @typedef {{ line: number; text: string }} SensitiveLineHit */

export const REQUIRED_LIVE_E2E_ENV_VARS = Object.freeze([
  "JYO_PROJECT_ID",
  "JYO_TASK_ID",
  "JYO_SESSION_COOKIE",
]);

export const EXPECTED_TIMELINE_STAGES = Object.freeze([
  "developer",
  "git",
  "review",
  "security",
  "approval",
  "scm",
  "completion",
]);

/** @param {NodeJS.ProcessEnv} processEnv */
export function parseExpectTimelineFlag(processEnv) {
  const raw = processEnv.JYO_EXPECT_TIMELINE;
  if (raw === undefined || raw === "") return true;
  const v = String(raw).trim().toLowerCase();
  return v !== "0" && v !== "false";
}

export function parseLiveE2eEnv(processEnv = process.env) {
  const env = (name, fallback = "") => String(processEnv[name] ?? fallback).trim();
  const envFlag = (name) => env(name) === "1" || env(name).toLowerCase() === "true";

  return {
    baseUrl: env("JYO_BASE_URL", "http://localhost:3000").replace(/\/$/, ""),
    projectId: env("JYO_PROJECT_ID"),
    taskId: env("JYO_TASK_ID"),
    sessionCookie: env("JYO_SESSION_COOKIE"),
    expectTimeline: parseExpectTimelineFlag(processEnv),
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

export function formatMissingEnvMessage(missing = REQUIRED_LIVE_E2E_ENV_VARS) {
  return (
    `Missing required env: ${missing.join(", ")}\n` +
    "Set JYO_BASE_URL (default http://localhost:3000), JYO_PROJECT_ID, JYO_TASK_ID, JYO_SESSION_COOKIE.\n" +
    "Run with --help for usage."
  );
}

const SENSITIVE_EVIDENCE_PATTERNS = [
  /session-token=/i,
  /next-auth\.session/i,
  /\bpassword\s*[:=]/i,
  /authorization:\s*bearer/i,
  /\bgithub_pat_/i,
  /\bghp_[a-z0-9]{20,}/i,
  /\bsk-[a-zA-Z0-9_-]{20,}/,
  /cursor[_-]?api[_-]?key/i,
  /\bprivate[_-]?token/i,
];

/** @param {string} text */
export function findSensitiveEvidenceLines(text) {
  /** @type {SensitiveLineHit[]} */
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of SENSITIVE_EVIDENCE_PATTERNS) {
      if (pattern.test(lines[i])) {
        hits.push({ line: i + 1, text: lines[i].trim().slice(0, 120) });
        break;
      }
    }
  }
  return hits;
}

/** @param {string} markdown */
export function parseEvidenceConclusionFromMarkdown(markdown) {
  const match = markdown.match(/Live E2E 결과:\s*\*\*(PASS|FAIL|PARTIAL)\*\*/);
  return match?.[1] ?? null;
}

/** `projects/JYOrchestration` root (from `apps/web/scripts/lib`). */
export function jyoOrchestrationRoot() {
  return join(_LIB_DIR, "..", "..", "..", "..");
}

/** Default evidence output dir under `projects/JYOrchestration/docs/runtime/evidence`. */
export function defaultLiveE2eEvidenceDir() {
  return join(jyoOrchestrationRoot(), "docs", "runtime", "evidence");
}

/** @param {NodeJS.ProcessEnv} [processEnv] */
export function resolveLiveE2eEvidenceDir(processEnv = process.env) {
  const override = String(processEnv.JYO_EVIDENCE_DIR ?? "").trim();
  return override || defaultLiveE2eEvidenceDir();
}

/** @param {Date} [d] */
export function formatLiveE2eEvidenceFilename(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `${LIVE_E2E_EVIDENCE_FILENAME_PREFIX}${stamp}.md`;
}

/**
 * @param {{ outputPath?: string }} config
 * @param {Date} [d]
 */
export function resolveLiveE2eOutputPath(config, d = new Date()) {
  if (config.outputPath) return config.outputPath;
  return join(defaultLiveE2eEvidenceDir(), formatLiveE2eEvidenceFilename(d));
}

export function readGitMetaForLiveE2e(cwd = jyoOrchestrationRoot()) {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd, encoding: "utf8" }).trim();
    const commit = execSync("git rev-parse HEAD", { cwd, encoding: "utf8" }).trim();
    return { branch, commit };
  } catch {
    return { branch: "(unknown)", commit: "(unknown)" };
  }
}

/** @param {string} dir */
export function listLiveE2eEvidenceFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".md") && name.startsWith(LIVE_E2E_EVIDENCE_FILENAME_PREFIX))
      .map((name) => {
        const path = join(dir, name);
        return { name, path, mtimeMs: statSync(path).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  } catch {
    return [];
  }
}

/**
 * @param {string} [evidenceDir]
 * @returns {{
 *   evidenceDir: string;
 *   files: { name: string; path: string; mtimeMs: number }[];
 *   latest: { name: string; path: string; mtimeMs: number } | null;
 *   conclusion: string | null;
 *   sensitive: SensitiveLineHit[];
 * }}
 */
export function scanLiveE2eEvidence(evidenceDir = resolveLiveE2eEvidenceDir()) {
  const files = listLiveE2eEvidenceFiles(evidenceDir);
  if (!files.length) {
    return { evidenceDir, files, latest: null, conclusion: null, sensitive: [] };
  }
  const latest = files[0];
  const content = readFileSync(latest.path, "utf8");
  return {
    evidenceDir,
    files,
    latest,
    conclusion: parseEvidenceConclusionFromMarkdown(content),
    sensitive: findSensitiveEvidenceLines(content),
  };
}

/** @param {LiveE2eCheck[]} checks */
export function formatLiveE2eCheckLines(checks) {
  return checks.map((c) => `${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.note ? ` — ${c.note}` : ""}`);
}

/**
 * @param {{ res: Response; json: unknown }} payload
 * @param {string} label
 * @returns {string | null}
 */
export function liveE2eHttpErrorMessage({ res, json }, label) {
  if (res.status === 401 || res.status === 403) {
    return `Session/RBAC issue (${label}): HTTP ${res.status} — check JYO_SESSION_COOKIE.`;
  }
  if (res.status >= 500) {
    return `API error (${label}): HTTP ${res.status} — ${JSON.stringify(json)?.slice(0, 400)}`;
  }
  if (!res.ok) {
    return `HTTP ${res.status} (${label}): ${JSON.stringify(json)?.slice(0, 400)}`;
  }
  return null;
}

/**
 * Console lines for `scan-live-e2e-evidence.mjs` (matches final execution doc §7).
 * @param {ReturnType<typeof scanLiveE2eEvidence>} result
 */
export function formatScanLiveE2eReport(result) {
  const lines = [
    `Evidence directory: ${result.evidenceDir}`,
    `Evidence files: ${result.files.length}`,
  ];

  if (!result.latest) {
    lines.push("", "No operator evidence found.", `See ${LIVE_E2E_FINAL_EXECUTION_DOC}`);
    lines.push("Then: node scripts/ai-team-runtime-live-e2e-check.mjs");
    return { lines, exitCode: 0, scanOk: false };
  }

  const sensitiveCount = result.sensitive.length;
  const scanOk = sensitiveCount === 0;

  lines.push(
    "",
    `Latest: ${result.latest.name}`,
    `Live E2E conclusion: ${result.conclusion ?? "(not found)"}`,
    `Sensitive pattern hits: ${sensitiveCount}`,
    `Scan result: ${scanOk ? "OK (no sensitive patterns)" : "BLOCKED (sensitive patterns)"}`
  );

  if (sensitiveCount) {
    lines.push("", "WARNING: possible secrets in evidence — do not commit this file.");
    for (const hit of result.sensitive.slice(0, 5)) {
      lines.push(`  line ${hit.line}: ${hit.text}`);
    }
    if (sensitiveCount > 5) lines.push(`  ... and ${sensitiveCount - 5} more`);
    lines.push("", "Gate: Level 3 next step BLOCKED until evidence is redacted and re-generated.");
    return { lines, exitCode: 1, scanOk: false };
  }

  lines.push("", "No obvious sensitive patterns detected (manual review still recommended).");
  lines.push(
    "",
    "Next: summarize into docs/runtime/ai-team-runtime-level3-manual-e2e.md (templates in final execution doc §9)."
  );
  lines.push("Never commit docs/runtime/evidence/*.md");

  if (result.conclusion === "PASS") {
    lines.push(
      "Gate: evidence PASS — operator may update manual-e2e and proceed to TaskHistory integration (§10)."
    );
  } else if (result.conclusion) {
    lines.push(`Gate: evidence ${result.conclusion} — next step held per final execution doc §10.`);
  }

  return { lines, exitCode: 0, scanOk: true };
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
