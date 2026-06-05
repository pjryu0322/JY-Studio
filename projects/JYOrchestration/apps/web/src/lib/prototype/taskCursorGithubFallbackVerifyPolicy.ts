import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

import type { ImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";

import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

import type { ImplementationRuntimeRunView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";



/**

 * CodeTask 단위 Cursor Agent 프롬프트 전달 후 GitHub 완료 판단:

 * - 최초 점검: launch 후 60초

 * - 이후: 10초 간격 재점검 (branch/commit 없으면 failed 아님 — transient)

 */

export const TASK_CURSOR_GITHUB_INITIAL_WAIT_MS = 60 * 1000;

export const TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS = 10 * 1000;



/** @deprecated — use TASK_CURSOR_GITHUB_INITIAL_WAIT_MS */

export const TASK_CURSOR_GITHUB_PROGRESS_POLL_INTERVAL_MS = TASK_CURSOR_GITHUB_INITIAL_WAIT_MS;

/** @deprecated — use TASK_CURSOR_GITHUB_INITIAL_WAIT_MS */

export const TASK_CURSOR_GITHUB_PROGRESS_LAUNCH_GRACE_MS = TASK_CURSOR_GITHUB_INITIAL_WAIT_MS;

/** @deprecated */

export const TASK_CURSOR_GITHUB_FALLBACK_AFTER_MS = TASK_CURSOR_GITHUB_INITIAL_WAIT_MS;



export const TASK_CURSOR_LONG_RUNNING_LABEL_AFTER_MS = 15 * 60 * 1000;

export const TASK_CURSOR_STALE_OR_REWORK_AFTER_MS = 30 * 60 * 1000;



export function parseGithubProgressLastCheckMs(

  execution?: TaskCursorExecutionV1 | null,

): number | null {

  const raw = String(execution?.githubProgressLastCheckAt ?? "").trim();

  if (!raw) return null;

  const t = Date.parse(raw);

  return Number.isFinite(t) ? t : null;

}



/** Cursor launch 시각 — poll tick이 updatedAt을 갱신하므로 createdAt 우선 */

export function resolveCursorLaunchElapsedMs(

  execution: TaskCursorExecutionV1,

  nowMs: number = Date.now(),

): number | null {

  const started = String(execution.createdAt ?? execution.updatedAt ?? "").trim();

  if (!started) return null;

  const t = Date.parse(started);

  if (!Number.isFinite(t)) return null;

  return Math.max(0, nowMs - t);

}



/** 이번 CodeTask Cursor launch 시각(오래된 execution.createdAt 오용 방지) */

export function resolveEffectiveGithubLaunchMs(input: {

  readonly quickRun?: ImplementationQuickRunV1 | null;

  readonly run?: CodeTaskExecutionRunV1 | null;

  readonly dbRun?: ImplementationRuntimeRunView | null;

  readonly execution?: TaskCursorExecutionV1 | null;

}): number | null {

  const stamps: number[] = [];

  for (const raw of [

    input.dbRun?.startedAt,

    input.run?.startedAt,

    input.run?.createdAt,

    input.quickRun?.startedAt,

    input.execution?.createdAt,

  ]) {

    const t = Date.parse(String(raw ?? ""));

    if (Number.isFinite(t)) stamps.push(t);

  }

  return stamps.length ? Math.max(...stamps) : null;

}



/** GitHub REST 점검을 지금 실행해도 되는지 (60초 후 1회, 이후 10초마다) */

export function isGithubProgressPollDue(input: {

  readonly launchMs: number | null;

  readonly lastCheckMs?: number | null;

  readonly nowMs?: number;

}): boolean {

  const now = input.nowMs ?? Date.now();

  if (input.launchMs == null) return false;

  const elapsed = Math.max(0, now - input.launchMs);

  if (elapsed < TASK_CURSOR_GITHUB_INITIAL_WAIT_MS) return false;



  const lastCheck = input.lastCheckMs;

  if (lastCheck == null || !Number.isFinite(lastCheck)) {

    return true;

  }

  return now - lastCheck >= TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS;

}



export function resolveGithubProgressNextPollDelayMs(input: {

  readonly launchMs: number | null;

  readonly lastCheckMs?: number | null;

  readonly nowMs?: number;

}): number {

  const now = input.nowMs ?? Date.now();

  if (input.launchMs == null) {

    return TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS;

  }

  const elapsed = now - input.launchMs;

  if (elapsed < TASK_CURSOR_GITHUB_INITIAL_WAIT_MS) {

    return Math.max(1_000, TASK_CURSOR_GITHUB_INITIAL_WAIT_MS - elapsed);

  }

  const lastCheck = input.lastCheckMs;

  if (lastCheck == null || !Number.isFinite(lastCheck)) {

    return TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS;

  }

  const wait = TASK_CURSOR_GITHUB_RETRY_INTERVAL_MS - (now - lastCheck);

  return Math.max(1_000, wait);

}



/** in-flight Cursor 구간에서 GitHub progress 점검 시점 (Agent API 무관) */

export function shouldRunTaskCursorGithubProgressVerify(input: {

  readonly execution: TaskCursorExecutionV1;

  readonly quickRun?: ImplementationQuickRunV1 | null;

  readonly run?: CodeTaskExecutionRunV1 | null;

  readonly dbRun?: ImplementationRuntimeRunView | null;

  readonly nowMs?: number;

}): boolean {

  const status = input.execution.status;
  if (
    status !== "cursor_running" &&
    status !== "cursor_requested" &&
    status !== "github_verifying"
  ) {
    return false;
  }

  const branch = String(input.execution.workBranch ?? "").trim();

  if (!branch) return false;



  const launchMs = resolveEffectiveGithubLaunchMs({

    quickRun: input.quickRun,

    run: input.run,

    dbRun: input.dbRun,

    execution: input.execution,

  });

  const lastCheckMs = parseGithubProgressLastCheckMs(input.execution);

  return isGithubProgressPollDue({ launchMs, lastCheckMs, nowMs: input.nowMs });

}



/** @deprecated — shouldRunTaskCursorGithubProgressVerify */

export function shouldRunTaskCursorGithubFallbackVerify(input: {

  readonly execution: TaskCursorExecutionV1;

  readonly agentStatus?: string | null;

  readonly nowMs?: number;

}): boolean {

  return shouldRunTaskCursorGithubProgressVerify({

    execution: input.execution,

    nowMs: input.nowMs,

  });

}



export function isTaskCursorLongRunningWithoutTerminal(input: {

  readonly execution: TaskCursorExecutionV1;

  readonly nowMs?: number;

}): boolean {

  const elapsed = resolveCursorLaunchElapsedMs(input.execution, input.nowMs);

  return elapsed != null && elapsed >= TASK_CURSOR_LONG_RUNNING_LABEL_AFTER_MS;

}



export function isTaskCursorStaleByDuration(input: {

  readonly execution: TaskCursorExecutionV1;

  readonly branchDetected: boolean;

  readonly commitDetected: boolean;

  readonly nowMs?: number;

}): boolean {

  const elapsed = resolveCursorLaunchElapsedMs(input.execution, input.nowMs);

  if (elapsed == null || elapsed < TASK_CURSOR_STALE_OR_REWORK_AFTER_MS) return false;

  return !input.branchDetected && !input.commitDetected;

}


