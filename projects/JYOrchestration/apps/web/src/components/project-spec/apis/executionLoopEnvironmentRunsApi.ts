import type { ApiResponse } from "../types";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

export async function postExecutionLoopRun(
  projectId: string,
  body?: { action?: "pause" | "resume"; taskId?: string }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/execution-loop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json()) as ApiResponse<{ steps?: unknown[] }>;
  return { res, json };
}

export async function fetchExecutionLoopStatus(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/execution-loop`, {
    method: "GET",
  });
  const json = (await res.json()) as ApiResponse<{ paused: boolean }>;
  return { res, json };
}

export type EnvironmentTestLastDto = {
  taskId: string;
  taskKind?: string | null;
  name: string;
  taskStatus: string;
  workflowStatus: string | null;
  branchName: string | null;
  prUrl: string | null;
  updatedAt: string;
  mergeCommitSha?: string | null;
  mergedAt?: string | null;
  envTestRemoteBranchDeletedAt?: string | null;
  envTestMergeBlockedReason?: string | null;
  envTestMergeStartedAt?: string | null;
  nextTaskReady?: boolean | null;
  nextTaskId?: string | null;
  nextTaskName?: string | null;
  nextTaskBlockedReason?: string | null;
  stage2ExecutorResult?: "PASS" | "FAIL" | null;
  stage2FinalOutcome?: "COMPLETED" | "PARTIAL" | "FAILED" | null;
  stage2ScmParticipant?: "AI" | "PLATFORM" | null;
  stage2ScmDisplay?: "PASS" | "BLOCKED" | "PLATFORM_FALLBACK" | "VERIFY_FAILED" | null;
  stage2ReviewerResult?: "PASS" | "FAIL" | "MISSING" | "DISABLED" | null;
  stage2ReviewerReason?: string | null;
  stage2SecurityResult?: "PASS" | "FAIL" | "MISSING" | "DISABLED" | null;
  stage2SecurityReason?: string | null;
  stage2ScmResult?: "MERGED" | "BLOCKED" | "VERIFY_FAILED" | null;
  stage2ScmReason?: string | null;
  stage2TotalTimeMs?: number | null;
  stage2TopBottleneckStage?: string | null;
  stage2TopBottleneckMs?: number | null;
  stage2UiHint?: string | null;
  stage2EstimatedBottleneck?: string | null;
  stage2LivePhaseLabel?: string | null;
  stage2CurrentStep?: string | null;
  stage2CurrentPhase?: string | null;
  stage2CursorStatus?: {
    prepare: "PENDING" | "RUNNING" | "DONE";
    generate: "PENDING" | "RUNNING" | "DONE";
    commit: "PENDING" | "RUNNING" | "DONE";
    push: "PENDING" | "RUNNING" | "DONE";
  } | null;
  stage2GitStatus?: { branchDetected: boolean; branchReflected: boolean } | null;
  stage2PlatformStatus?: { prCreated: boolean } | null;
  stage2CursorSignal?: {
    agentLaunchedAtMs?: number;
    pushStartedAtMs?: number;
    pushCompletedHintAtMs?: number;
    branchNameHint?: string;
    headShaHint?: string;
    commitHashHint?: string;
    changedFilesCountHint?: number;
  } | null;
  stage2RuntimeBottleneckPhase?: string | null;
  stage2RuntimeBottleneckMs?: number | null;
  stage2CurrentBottleneckHint?: string | null;
  stage2RunElapsedMs?: number | null;
  stage2TimingBreakdown?: Record<string, number> | null;
  cursorPromptRaw?: string | null;
  cursorPromptLength?: number | null;
  cursorPromptPreview?: string | null;
  stage2CursorPromptRaw?: string | null;
  stage2CursorPromptCanViewRaw?: boolean | null;
  stage2FailureMessage?: string | null;
  stage1TotalTimeMs?: number | null;
  stage1TimingBreakdown?: Record<string, number> | null;
  stage1TopBottleneckStage?: string | null;
  stage1TopBottleneckMs?: number | null;
  stage1RunCreatedAt?: string | null;
  envTestStage1FailureLine?: string | null;
  stage1PrCreateFailureHttpStatus?: number | null;
  stage1PrCreateFailureBranch?: string | null;
  stage1PrCreateFailureGithubCode?: string | null;
  isRunning?: boolean | null;
  isTerminal?: boolean | null;
  stage1CurrentPhase?: "cursor" | "branchDetect" | "prCreation" | "merge" | null;
  stage1CurrentPhaseStartedAt?: string | null;
  stage1CurrentPhaseElapsedMsAtSnapshot?: number | null;
  stage1SnapshotAtMs?: number | null;
  stage1ElapsedMsAtSnapshot?: number | null;
  stage1PollStaleThresholdMs?: number | null;
  stage1ExecutionRunId?: string | null;
  connectionTestMergeMode?: "skip" | "auto" | null;
};

export async function fetchEnvironmentTestLast(projectId: string, opts?: { stage?: 2 }) {
  const encoded = encodeURIComponent(projectId);
  const q = opts?.stage === 2 ? "?stage=2" : "";
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/environment-test${q}`);
  const json = (await res.json()) as ApiResponse<{ last: EnvironmentTestLastDto | null }>;
  return { res, json };
}

export async function postEnvironmentTestRun(
  projectId: string,
  opts?: { stage?: 2; mergeMode?: "skip" | "auto"; allowUnvalidated?: boolean }
) {
  const encoded = encodeURIComponent(projectId);
  const body =
    opts?.stage === 2
      ? { stage: 2 }
      : {
          ...(opts?.mergeMode != null ? { mergeMode: opts.mergeMode } : {}),
          ...(opts?.allowUnvalidated === true ? { allowUnvalidated: true } : {}),
        };
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/environment-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{
    taskId?: string;
    steps?: unknown[];
    last?: EnvironmentTestLastDto | null;
  }>;
  return { res, json };
}

export async function postStage2DefaultAiMembers(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/stage2-default-ai-members`, {
    method: "POST",
  });
  const json = (await res.json()) as ApiResponse<{ created: string[]; skipped: string[] }>;
  return { res, json };
}

export type ExecutionReviewerStepDto = {
  memberId: string;
  name: string;
  role: string;
  model: string;
  decision: string;
  summary: string;
  issues?: string[];
  reviewedAt: string;
};

export type TeamRuntimeSummaryDto = Readonly<{
  status: string;
  statusKo: string;
  developer: Readonly<{
    status: string;
    cursorRunId?: string | null;
    commitSha?: string | null;
    branchName?: string | null;
    changedFilesCount?: number;
  }>;
  review: Readonly<{ status: string; issues?: readonly string[] }>;
  security: Readonly<{ status: string; issues?: readonly string[] }>;
  approval: Readonly<{ required: boolean; status: string }>;
  pr?: Readonly<{
    pullRequestUrl?: string | null;
    pullRequestNumber?: number | null;
    pullRequestState?: string | null;
    mergedAt?: string | null;
  }>;
  blockReason?: string | null;
  timeline?: readonly TeamRuntimeTimelineItemDto[];
}>;

export type TeamRuntimeTimelineItemDto = Readonly<{
  id: string;
  stage: string;
  titleKo: string;
  status: string;
  summaryKo?: string | null;
  detailKo?: string | null;
  actorKo?: string | null;
  prUrl?: string | null;
  prNumber?: number | null;
  branchName?: string | null;
  commitSha?: string | null;
  changedFileCount?: number | null;
  blockReason?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}>;

export type TaskExecutionRunDto = {
  id: string;
  projectId: string;
  taskId: string;
  status: string;
  teamExecutionStatus?: string | null;
  teamRuntimeStatus?: string | null;
  teamRuntime?: TeamRuntimeSummaryDto | null;
  branchName: string | null;
  cursorRunId: string | null;
  cursorSummary: string | null;
  changedFiles: string[];
  gitSummary: string | null;
  evaluationReason: string | null;
  evaluationDecision?: string | null;
  evaluationReviewerSteps?: ExecutionReviewerStepDto[];
  validationOutput: string | null;
  runError?: string | null;
  commitStatus: string | null;
  pushStatus: string | null;
  commitSha: string | null;
  prStatus: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
};

export async function fetchExecutionRuns(projectId: string, opts?: { taskId?: string; take?: number }) {
  const encoded = encodeURIComponent(projectId);
  const q = new URLSearchParams();
  if (opts?.taskId) q.set("taskId", opts.taskId);
  if (opts?.take != null) q.set("take", String(opts.take));
  const qs = q.toString();
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/execution-runs${qs ? `?${qs}` : ""}`);
  const json = (await res.json()) as ApiResponse<TaskExecutionRunDto[]>;
  return { res, json };
}
