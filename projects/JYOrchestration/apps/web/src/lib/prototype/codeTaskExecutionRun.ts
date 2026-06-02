import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { classifyCodeTaskExecutionRunFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunResult";
import { isInFlightCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";

export const CODE_TASK_EXECUTION_RUN_VERSION = "code_task_execution_run_v1" as const;

export type CodeTaskExecutionRunStatus =
  | "queued"
  | "prompt_building"
  | "cursor_requested"
  | "cursor_running"
  | "github_verifying"
  | "completed"
  | "no_code_change_completed"
  | "rework_required"
  | "failed";

export type CodeTaskExecutionRunV1 = Readonly<{
  version: typeof CODE_TASK_EXECUTION_RUN_VERSION;
  runId: string;
  projectId: string;
  processTaskId: string;
  workItemId: string;
  codeTaskId: string;
  status: CodeTaskExecutionRunStatus;
  attemptNo: number;
  developerPrompt?: string;
  cursorRequestId?: string;
  cursorRunId?: string;
  repository?: string;
  baseBranch?: string;
  workBranch?: string;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  baseCommitSha?: string;
  branchHeadCommitSha?: string;
  commitSha?: string;
  changedFiles?: readonly string[];
  noCodeChangeEvidence?: string;
  failureReason?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
}>;

const RUN_STATUSES = new Set<CodeTaskExecutionRunStatus>([
  "queued",
  "prompt_building",
  "cursor_requested",
  "cursor_running",
  "github_verifying",
  "completed",
  "no_code_change_completed",
  "rework_required",
  "failed",
]);

export function parseCodeTaskExecutionRunV1(raw: unknown): CodeTaskExecutionRunV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== CODE_TASK_EXECUTION_RUN_VERSION) return null;
  const runId = String(o.runId ?? "").trim();
  const projectId = String(o.projectId ?? "").trim();
  const processTaskId = String(o.processTaskId ?? "").trim();
  const workItemId = String(o.workItemId ?? "").trim();
  const codeTaskId = String(o.codeTaskId ?? "").trim();
  const status = String(o.status ?? "").trim() as CodeTaskExecutionRunStatus;
  const createdAt = String(o.createdAt ?? "").trim();
  const updatedAt = String(o.updatedAt ?? "").trim();
  const attemptNo = Number(o.attemptNo);
  if (!runId || !projectId || !processTaskId || !workItemId || !codeTaskId) return null;
  if (!RUN_STATUSES.has(status) || !Number.isFinite(attemptNo) || attemptNo < 1) return null;
  if (!createdAt || !updatedAt) return null;
  const changedFiles = Array.isArray(o.changedFiles)
    ? (o.changedFiles as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
    : undefined;
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId,
    projectId,
    processTaskId,
    workItemId,
    codeTaskId,
    status,
    attemptNo,
    createdAt,
    updatedAt,
    ...(typeof o.developerPrompt === "string" && o.developerPrompt.trim()
      ? { developerPrompt: o.developerPrompt.trim() }
      : {}),
    ...(typeof o.cursorRunId === "string" && o.cursorRunId.trim() ? { cursorRunId: o.cursorRunId.trim() } : {}),
    ...(typeof o.repository === "string" && o.repository.trim() ? { repository: o.repository.trim() } : {}),
    ...(typeof o.baseBranch === "string" && o.baseBranch.trim() ? { baseBranch: o.baseBranch.trim() } : {}),
    ...(typeof o.workBranch === "string" && o.workBranch.trim() ? { workBranch: o.workBranch.trim() } : {}),
    ...(typeof o.pullRequestUrl === "string" && o.pullRequestUrl.trim()
      ? { pullRequestUrl: o.pullRequestUrl.trim() }
      : {}),
    ...(typeof o.pullRequestNumber === "number" && Number.isFinite(o.pullRequestNumber)
      ? { pullRequestNumber: o.pullRequestNumber }
      : {}),
    ...(typeof o.commitSha === "string" && o.commitSha.trim() ? { commitSha: o.commitSha.trim() } : {}),
    ...(typeof o.branchHeadCommitSha === "string" && o.branchHeadCommitSha.trim()
      ? { branchHeadCommitSha: o.branchHeadCommitSha.trim() }
      : {}),
    ...(typeof o.noCodeChangeEvidence === "string" && o.noCodeChangeEvidence.trim()
      ? { noCodeChangeEvidence: o.noCodeChangeEvidence.trim() }
      : {}),
    ...(typeof o.failureReason === "string" && o.failureReason.trim()
      ? { failureReason: o.failureReason.trim() }
      : {}),
    ...(typeof o.errorMessage === "string" && o.errorMessage.trim()
      ? { errorMessage: o.errorMessage.trim() }
      : {}),
    ...(changedFiles?.length ? { changedFiles } : {}),
    ...(typeof o.startedAt === "string" && o.startedAt.trim() ? { startedAt: o.startedAt.trim() } : {}),
    ...(typeof o.completedAt === "string" && o.completedAt.trim() ? { completedAt: o.completedAt.trim() } : {}),
  };
}

export function parseCodeTaskExecutionRunsV1(
  raw: unknown,
): readonly CodeTaskExecutionRunV1[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const runs: CodeTaskExecutionRunV1[] = [];
  for (const row of raw) {
    const parsed = parseCodeTaskExecutionRunV1(row);
    if (parsed) runs.push(parsed);
  }
  return runs;
}

export function findActiveCodeTaskExecutionRun(
  runs: readonly CodeTaskExecutionRunV1[] | null | undefined,
): CodeTaskExecutionRunV1 | null {
  for (const run of runs ?? []) {
    if (isInFlightCodeTaskExecutionRunStatus(run.status)) return run;
  }
  return null;
}

export function findLatestRunForCodeTask(
  runs: readonly CodeTaskExecutionRunV1[] | null | undefined,
  codeTaskId: string,
): CodeTaskExecutionRunV1 | null {
  const id = codeTaskId.trim();
  const matches = (runs ?? []).filter((r) => r.codeTaskId === id);
  if (!matches.length) return null;
  return [...matches].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export function getNextCodeTaskRunAttemptNo(
  runs: readonly CodeTaskExecutionRunV1[],
  codeTaskId: string,
): number {
  const max = runs
    .filter((r) => r.codeTaskId === codeTaskId.trim())
    .reduce((acc, r) => Math.max(acc, r.attemptNo), 0);
  return max + 1;
}

export function createCodeTaskExecutionRun(input: {
  readonly projectId: string;
  readonly processTaskId: string;
  readonly workItemId: string;
  readonly codeTaskId: string;
  readonly runs?: readonly CodeTaskExecutionRunV1[];
  readonly developerPrompt?: string;
  readonly nowIso?: string;
}): CodeTaskExecutionRunV1 {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: crypto.randomUUID(),
    projectId: input.projectId.trim(),
    processTaskId: input.processTaskId.trim(),
    workItemId: input.workItemId.trim(),
    codeTaskId: input.codeTaskId.trim(),
    status: "queued",
    attemptNo: getNextCodeTaskRunAttemptNo(input.runs ?? [], input.codeTaskId),
    createdAt: now,
    updatedAt: now,
    ...(input.developerPrompt?.trim() ? { developerPrompt: input.developerPrompt.trim() } : {}),
  };
}

export function appendCodeTaskExecutionRun(
  runs: readonly CodeTaskExecutionRunV1[] | null | undefined,
  run: CodeTaskExecutionRunV1,
): CodeTaskExecutionRunV1[] {
  return [...(runs ?? []), run];
}

export function updateCodeTaskExecutionRun(
  runs: readonly CodeTaskExecutionRunV1[],
  runId: string,
  patch: Partial<CodeTaskExecutionRunV1> & { readonly updatedAt?: string },
): CodeTaskExecutionRunV1[] {
  const id = runId.trim();
  const now = patch.updatedAt ?? new Date().toISOString();
  return runs.map((run) => {
    if (run.runId !== id) return run;
    const terminal =
      patch.status &&
      !isInFlightCodeTaskExecutionRunStatus(patch.status) &&
      patch.status !== "queued";
    return {
      ...run,
      ...patch,
      updatedAt: now,
      ...(patch.changedFiles ? { changedFiles: [...patch.changedFiles] } : {}),
      ...(!run.startedAt && patch.status && patch.status !== "queued" ? { startedAt: now } : {}),
      ...(terminal && !patch.completedAt ? { completedAt: now } : {}),
    };
  });
}

export function syncCodeTaskExecutionRunsFromTaskCursor(input: {
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly execution: TaskCursorExecutionV1;
  readonly codeTaskId: string;
  readonly workItemId: string;
  readonly nowIso?: string;
}): CodeTaskExecutionRunV1[] {
  const codeTaskId = input.codeTaskId.trim();
  const now = input.nowIso ?? new Date().toISOString();
  let runs = [...(input.runs ?? [])];
  let run = runs.find(
    (r) =>
      r.codeTaskId === codeTaskId &&
      (r.cursorRunId === input.execution.cursorRunId || isInFlightCodeTaskExecutionRunStatus(r.status)),
  ) ?? findLatestRunForCodeTask(runs, codeTaskId);

  if (!run) {
    run = createCodeTaskExecutionRun({
      projectId: input.execution.projectId,
      processTaskId: input.execution.taskId,
      workItemId: input.workItemId,
      codeTaskId,
      runs,
      nowIso: now,
    });
    runs = appendCodeTaskExecutionRun(runs, run);
  }

  const classified = classifyCodeTaskExecutionRunFromTaskCursor(input.execution);
  return updateCodeTaskExecutionRun(runs, run.runId, {
    status: classified.status,
    repository: input.execution.targetRepository,
    baseBranch: input.execution.baseBranch,
    workBranch: input.execution.workBranch,
    cursorRunId: input.execution.cursorRunId,
    commitSha: input.execution.commitSha,
    changedFiles: input.execution.changedFiles,
    branchHeadCommitSha: classified.branchHeadCommitSha,
    noCodeChangeEvidence: classified.noCodeChangeEvidence,
    failureReason: classified.failureReason,
    errorMessage: classified.errorMessage,
    updatedAt: now,
  });
}
