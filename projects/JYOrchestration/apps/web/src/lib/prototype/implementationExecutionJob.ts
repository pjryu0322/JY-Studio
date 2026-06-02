import { randomUuid } from "@/lib/platform-orchestration/platformIds";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { isInFlightTaskCursorExecution, isTaskCursorStatusCheckStopped } from "@/lib/prototype/taskCursorClientPollLoop";
import { classifyImplementationExecutionJobFromTaskCursor } from "@/lib/prototype/implementationExecutionJobResult";

export const IMPLEMENTATION_EXECUTION_JOB_VERSION = "implementation_execution_job_v1" as const;

export type ImplementationExecutionJobStatus =
  | "queued"
  | "running"
  | "github_verifying"
  | "completed"
  | "no_code_change_completed"
  | "rework_required"
  | "blocked_by_dependency"
  | "status_check_stopped"
  | "timeout"
  | "failed";

export type ImplementationExecutionJobStep =
  | "queued"
  | "prompt_building"
  | "cursor_requested"
  | "cursor_running"
  | "github_verifying"
  | "result_classifying"
  | "completed"
  | "stopped";

export type ImplementationExecutionJobV1 = Readonly<{
  version: typeof IMPLEMENTATION_EXECUTION_JOB_VERSION;
  jobId: string;
  projectId: string;
  processTaskId: string;
  codeTaskIds: readonly string[];
  workItemIds: readonly string[];
  attemptNo: number;
  status: ImplementationExecutionJobStatus;
  currentStep: ImplementationExecutionJobStep;
  targetRepository?: string;
  baseBranch?: string;
  workBranch?: string;
  baseCommitSha?: string;
  branchHeadCommitSha?: string;
  commitSha?: string;
  changedFiles?: readonly string[];
  noCodeChangeEvidence?: string;
  failureReason?: string;
  errorMessage?: string;
  cursorRunId?: string;
  createdAt: string;
  startedAt?: string;
  updatedAt: string;
  completedAt?: string;
}>;

const ACTIVE_JOB_STATUSES = new Set<ImplementationExecutionJobStatus>([
  "queued",
  "running",
  "github_verifying",
]);

const TERMINAL_JOB_STATUSES = new Set<ImplementationExecutionJobStatus>([
  "completed",
  "no_code_change_completed",
  "rework_required",
  "failed",
  "timeout",
  "status_check_stopped",
  "blocked_by_dependency",
]);

const JOB_STATUSES = new Set<ImplementationExecutionJobStatus>([
  ...ACTIVE_JOB_STATUSES,
  ...TERMINAL_JOB_STATUSES,
]);

const JOB_STEPS = new Set<ImplementationExecutionJobStep>([
  "queued",
  "prompt_building",
  "cursor_requested",
  "cursor_running",
  "github_verifying",
  "result_classifying",
  "completed",
  "stopped",
]);

export function isActiveImplementationExecutionJobStatus(
  status: ImplementationExecutionJobStatus,
): boolean {
  return ACTIVE_JOB_STATUSES.has(status);
}

export function isTerminalImplementationExecutionJobStatus(
  status: ImplementationExecutionJobStatus,
): boolean {
  return TERMINAL_JOB_STATUSES.has(status);
}

export function parseImplementationExecutionJobV1(raw: unknown): ImplementationExecutionJobV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== IMPLEMENTATION_EXECUTION_JOB_VERSION) return null;
  const jobId = String(o.jobId ?? "").trim();
  const projectId = String(o.projectId ?? "").trim();
  const processTaskId = String(o.processTaskId ?? "").trim();
  const status = String(o.status ?? "").trim() as ImplementationExecutionJobStatus;
  const currentStep = String(o.currentStep ?? "").trim() as ImplementationExecutionJobStep;
  const createdAt = String(o.createdAt ?? "").trim();
  const updatedAt = String(o.updatedAt ?? "").trim();
  const attemptNo = Number(o.attemptNo);
  if (!jobId || !projectId || !processTaskId || !JOB_STATUSES.has(status) || !JOB_STEPS.has(currentStep)) {
    return null;
  }
  if (!Number.isFinite(attemptNo) || attemptNo < 1 || !createdAt || !updatedAt) return null;
  const codeTaskIds = Array.isArray(o.codeTaskIds)
    ? (o.codeTaskIds as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  const workItemIds = Array.isArray(o.workItemIds)
    ? (o.workItemIds as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  const changedFiles = Array.isArray(o.changedFiles)
    ? (o.changedFiles as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
    : undefined;
  return {
    version: IMPLEMENTATION_EXECUTION_JOB_VERSION,
    jobId,
    projectId,
    processTaskId,
    codeTaskIds,
    workItemIds,
    attemptNo,
    status,
    currentStep,
    createdAt,
    updatedAt,
    ...(typeof o.targetRepository === "string" && o.targetRepository.trim()
      ? { targetRepository: o.targetRepository.trim() }
      : {}),
    ...(typeof o.baseBranch === "string" && o.baseBranch.trim() ? { baseBranch: o.baseBranch.trim() } : {}),
    ...(typeof o.workBranch === "string" && o.workBranch.trim() ? { workBranch: o.workBranch.trim() } : {}),
    ...(typeof o.baseCommitSha === "string" && o.baseCommitSha.trim()
      ? { baseCommitSha: o.baseCommitSha.trim() }
      : {}),
    ...(typeof o.branchHeadCommitSha === "string" && o.branchHeadCommitSha.trim()
      ? { branchHeadCommitSha: o.branchHeadCommitSha.trim() }
      : {}),
    ...(typeof o.commitSha === "string" && o.commitSha.trim() ? { commitSha: o.commitSha.trim() } : {}),
    ...(changedFiles?.length ? { changedFiles } : {}),
    ...(typeof o.noCodeChangeEvidence === "string" && o.noCodeChangeEvidence.trim()
      ? { noCodeChangeEvidence: o.noCodeChangeEvidence.trim() }
      : {}),
    ...(typeof o.failureReason === "string" && o.failureReason.trim()
      ? { failureReason: o.failureReason.trim() }
      : {}),
    ...(typeof o.errorMessage === "string" && o.errorMessage.trim()
      ? { errorMessage: o.errorMessage.trim() }
      : {}),
    ...(typeof o.cursorRunId === "string" && o.cursorRunId.trim() ? { cursorRunId: o.cursorRunId.trim() } : {}),
    ...(typeof o.startedAt === "string" && o.startedAt.trim() ? { startedAt: o.startedAt.trim() } : {}),
    ...(typeof o.completedAt === "string" && o.completedAt.trim() ? { completedAt: o.completedAt.trim() } : {}),
  };
}

export function parseImplementationExecutionJobsV1(
  raw: unknown,
): readonly ImplementationExecutionJobV1[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const jobs: ImplementationExecutionJobV1[] = [];
  for (const row of raw) {
    const parsed = parseImplementationExecutionJobV1(row);
    if (parsed) jobs.push(parsed);
  }
  return jobs;
}

export function getNextImplementationExecutionJobAttemptNo(
  jobs: readonly ImplementationExecutionJobV1[],
  processTaskId: string,
): number {
  const pid = processTaskId.trim();
  const max = jobs
    .filter((j) => j.processTaskId === pid)
    .reduce((acc, j) => Math.max(acc, j.attemptNo), 0);
  return max + 1;
}

export function findActiveImplementationExecutionJob(
  jobs: readonly ImplementationExecutionJobV1[] | null | undefined,
  projectId?: string,
): ImplementationExecutionJobV1 | null {
  const pid = projectId?.trim();
  const rows = [...(jobs ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const job of rows) {
    if (pid && job.projectId !== pid) continue;
    if (isActiveImplementationExecutionJobStatus(job.status)) return job;
  }
  return null;
}

export function findLatestJobByProcessTaskId(
  jobs: readonly ImplementationExecutionJobV1[] | null | undefined,
  processTaskId: string,
): ImplementationExecutionJobV1 | null {
  const tid = processTaskId.trim();
  if (!tid) return null;
  const matches = (jobs ?? []).filter((j) => j.processTaskId === tid);
  if (!matches.length) return null;
  return [...matches].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export function hasActiveJobForProcessTask(
  jobs: readonly ImplementationExecutionJobV1[] | null | undefined,
  processTaskId: string,
): boolean {
  const latest = findLatestJobByProcessTaskId(jobs, processTaskId);
  return Boolean(latest && isActiveImplementationExecutionJobStatus(latest.status));
}

export function buildImplementationExecutionJobIdempotencyKey(input: {
  readonly projectId: string;
  readonly processTaskId: string;
  readonly attemptNo: number;
}): string {
  return `${input.projectId.trim()}:${input.processTaskId.trim()}:${input.attemptNo}`;
}

export function createImplementationExecutionJob(input: {
  readonly projectId: string;
  readonly processTaskId: string;
  readonly codeTaskIds?: readonly string[];
  readonly workItemIds?: readonly string[];
  readonly jobs?: readonly ImplementationExecutionJobV1[] | null;
  readonly nowIso?: string;
  readonly jobId?: string;
}): ImplementationExecutionJobV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const processTaskId = input.processTaskId.trim();
  const prior = input.jobs ?? [];
  if (hasActiveJobForProcessTask(prior, processTaskId)) {
    throw new Error(`active job already exists for ${processTaskId}`);
  }
  const attemptNo = getNextImplementationExecutionJobAttemptNo(prior, processTaskId);
  return {
    version: IMPLEMENTATION_EXECUTION_JOB_VERSION,
    jobId: input.jobId?.trim() || randomUuid(),
    projectId: input.projectId.trim(),
    processTaskId,
    codeTaskIds: [...(input.codeTaskIds ?? [])],
    workItemIds: [...(input.workItemIds ?? [])],
    attemptNo,
    status: "queued",
    currentStep: "queued",
    createdAt: now,
    updatedAt: now,
  };
}

export function appendImplementationExecutionJob(
  jobs: readonly ImplementationExecutionJobV1[] | null | undefined,
  job: ImplementationExecutionJobV1,
): ImplementationExecutionJobV1[] {
  return [...(jobs ?? []), job];
}

export function updateImplementationExecutionJob(
  jobs: readonly ImplementationExecutionJobV1[] | null | undefined,
  jobId: string,
  patch: Partial<
    Pick<
      ImplementationExecutionJobV1,
      | "status"
      | "currentStep"
      | "targetRepository"
      | "baseBranch"
      | "workBranch"
      | "baseCommitSha"
      | "branchHeadCommitSha"
      | "commitSha"
      | "changedFiles"
      | "noCodeChangeEvidence"
      | "failureReason"
      | "errorMessage"
      | "cursorRunId"
      | "startedAt"
      | "completedAt"
      | "workItemIds"
      | "codeTaskIds"
    >
  > & { readonly updatedAt?: string },
): ImplementationExecutionJobV1[] {
  const id = jobId.trim();
  const now = patch.updatedAt ?? new Date().toISOString();
  return (jobs ?? []).map((job) => {
    if (job.jobId !== id) return job;
    const terminal = patch.status && isTerminalImplementationExecutionJobStatus(patch.status);
    return {
      ...job,
      ...patch,
      updatedAt: now,
      ...(patch.status && !job.startedAt && isActiveImplementationExecutionJobStatus(patch.status)
        ? { startedAt: now }
        : {}),
      ...(terminal && !patch.completedAt ? { completedAt: now } : {}),
      ...(patch.changedFiles ? { changedFiles: [...patch.changedFiles] } : {}),
      ...(patch.workItemIds ? { workItemIds: [...patch.workItemIds] } : {}),
      ...(patch.codeTaskIds ? { codeTaskIds: [...patch.codeTaskIds] } : {}),
    };
  });
}

export function mapTaskCursorStepToJobStep(
  execution: TaskCursorExecutionV1,
): ImplementationExecutionJobStep {
  if (isTaskCursorStatusCheckStopped(execution)) return "stopped";
  switch (execution.status) {
    case "pending":
    case "prompt_ready":
      return "prompt_building";
    case "cursor_requested":
      return "cursor_requested";
    case "cursor_running":
      return "cursor_running";
    case "github_verifying":
      return "github_verifying";
    case "cursor_completed":
    case "github_verified":
    case "review_pending":
    case "security_pending":
    case "scm_pending":
      return "result_classifying";
    default:
      return "stopped";
  }
}

export function mapTaskCursorToActiveJobStatus(
  execution: TaskCursorExecutionV1,
): ImplementationExecutionJobStatus {
  if (isTaskCursorStatusCheckStopped(execution)) return "status_check_stopped";
  if (execution.status === "github_verifying") return "github_verifying";
  if (isInFlightTaskCursorExecution(execution)) return "running";
  return "running";
}

export function syncImplementationExecutionJobFromTaskCursor(input: {
  readonly jobs: readonly ImplementationExecutionJobV1[] | null | undefined;
  readonly execution: TaskCursorExecutionV1;
  readonly processTaskId?: string;
  readonly nowIso?: string;
}): ImplementationExecutionJobV1[] {
  const processTaskId = (input.processTaskId ?? input.execution.taskId).trim();
  const now = input.nowIso ?? new Date().toISOString();
  let jobs = [...(input.jobs ?? [])];
  let job =
    jobs.find(
      (j) =>
        j.processTaskId === processTaskId &&
        (j.cursorRunId === input.execution.cursorRunId ||
          isActiveImplementationExecutionJobStatus(j.status)),
    ) ?? findLatestJobByProcessTaskId(jobs, processTaskId);

  if (!job) {
    job = createImplementationExecutionJob({
      projectId: input.execution.projectId,
      processTaskId,
      workItemIds: input.execution.workItemIds,
      jobs,
      nowIso: now,
    });
    jobs = appendImplementationExecutionJob(jobs, job);
  }

  const classified = classifyImplementationExecutionJobFromTaskCursor(input.execution);
  const inFlight = isInFlightTaskCursorExecution(input.execution);
  const patch: Parameters<typeof updateImplementationExecutionJob>[2] = {
    updatedAt: now,
    currentStep: mapTaskCursorStepToJobStep(input.execution),
    targetRepository: input.execution.targetRepository,
    baseBranch: input.execution.baseBranch,
    workBranch: input.execution.workBranch,
    workItemIds: input.execution.workItemIds,
    ...(input.execution.cursorRunId ? { cursorRunId: input.execution.cursorRunId } : {}),
    ...(input.execution.commitSha ? { commitSha: input.execution.commitSha } : {}),
    ...(input.execution.changedFiles?.length ? { changedFiles: input.execution.changedFiles } : {}),
    ...(classified.branchHeadCommitSha ? { branchHeadCommitSha: classified.branchHeadCommitSha } : {}),
    ...(classified.noCodeChangeEvidence ? { noCodeChangeEvidence: classified.noCodeChangeEvidence } : {}),
    ...(classified.failureReason ? { failureReason: classified.failureReason } : {}),
    ...(classified.errorMessage ? { errorMessage: classified.errorMessage } : {}),
    status: inFlight
      ? mapTaskCursorToActiveJobStatus(input.execution)
      : classified.status,
  };

  return updateImplementationExecutionJob(jobs, job.jobId, patch);
}

export function collectTerminalFailedProcessTaskIds(
  jobs: readonly ImplementationExecutionJobV1[] | null | undefined,
): readonly string[] {
  const failed = new Set<string>();
  for (const job of jobs ?? []) {
    if (!isTerminalImplementationExecutionJobStatus(job.status)) continue;
    if (
      job.status === "failed" ||
      job.status === "rework_required" ||
      job.status === "timeout"
    ) {
      failed.add(job.processTaskId);
    }
  }
  return [...failed];
}

export function collectDependencySatisfiedProcessTaskIds(
  jobs: readonly ImplementationExecutionJobV1[] | null | undefined,
): readonly string[] {
  const satisfied = new Set<string>();
  for (const job of jobs ?? []) {
    if (
      job.status === "completed" ||
      job.status === "no_code_change_completed"
    ) {
      satisfied.add(job.processTaskId);
    }
  }
  return [...satisfied];
}
