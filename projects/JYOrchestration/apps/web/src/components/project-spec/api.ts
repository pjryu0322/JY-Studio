import {
  ApiResponse,
  Project,
  ProjectSpecPromptRecord,
  ProjectSpecResponseRecord,
  ProjectSpecVersionRecord,
  SpecPromptConfigRecord,
  TaskDraftDto,
  TaskItem,
} from "./types";
import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";

export type { GithubCapabilityValidationSnapshot };

export async function fetchProjectById(projectId: string): Promise<{
  project: Project | null;
  errorMessage: string | null;
}> {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<Project>;

  if (res.status === 404 || res.status === 403) {
    return {
      project: null,
      errorMessage: json.message || "프로젝트 정보를 불러오지 못했습니다.",
    };
  }

  if (!res.ok || !json.success || !json.data) {
    return {
      project: null,
      errorMessage: json.message || "프로젝트 정보를 불러오지 못했습니다.",
    };
  }

  return {
    project: json.data,
    errorMessage: null,
  };
}

export async function fetchGeneratedTasks(projectId: string) {
  const encodedProjectId = encodeURIComponent(projectId);
  const res = await fetch(`/api/task/generate?projectId=${encodedProjectId}`, {
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<TaskItem[]>;
  return { res, json };
}

export type SpecWorkspaceSnapshot = {
  project: Pick<
    Project,
    | "id"
    | "name"
    | "description"
    | "projectType"
    | "specCoreGoals"
    | "specScopeIn"
    | "specScopeOut"
    | "specTargetUsers"
    | "specSuccessCriteria"
    | "executionPlanMarkdown"
    | "selectedPlanCandidateId"
    | "confirmedSpecMarkdown"
    | "confirmedSpecResponseId"
    | "confirmedSpecAt"
    | "currentSpecVersionId"
  >;
  specVersions: ProjectSpecVersionRecord[];
  prompts: ProjectSpecPromptRecord[];
  responses: ProjectSpecResponseRecord[];
  specPromptConfig: SpecPromptConfigRecord | null;
};

export async function fetchSpecWorkspace(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/spec-workspace`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<SpecWorkspaceSnapshot>;
  return { res, json };
}

export async function patchSpecWorkspace(
  projectId: string,
  body: Partial<{
    name: string;
    description: string | null;
    projectType: string;
    specCoreGoals: string | null;
    specScopeIn: string | null;
    specScopeOut: string | null;
    specTargetUsers: string | null;
    specSuccessCriteria: string | null;
    executionPlanMarkdown: string | null;
    selectedPlanCandidateId: string | null;
    specPromptTemplate?: string | null;
    specPromptPreset?: string | null;
  }>
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/spec-workspace`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{
    project: SpecWorkspaceSnapshot["project"];
    specPromptConfig?: SpecPromptConfigRecord;
  }>;
  return { res, json };
}

export async function postSpecWorkspaceAction(
  projectId: string,
  body:
    | { action: "aiRequest"; model?: string; preset?: string; templatePrompt?: string }
    | { action: "confirm"; responseId: string }
    | {
        action: "confirmMerged";
        responseAId: string;
        responseBId: string;
        mergedMarkdown: string;
        selectedSections: Record<string, "A" | "B">;
      }
    | { action: "appendManualSpec"; markdown: string }
    | { action: "refineSpec"; model?: string }
    | { action: "rollbackSpec"; versionId: string }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/spec-workspace`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  return { res, json };
}

export async function fetchProjectTaskDrafts(projectId: string, options?: { status?: string }) {
  const encoded = encodeURIComponent(projectId);
  const q = options?.status ? `?status=${encodeURIComponent(options.status)}` : "";
  const res = await fetch(`/api/projects/${encoded}/task-drafts${q}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<TaskDraftDto[]>;
  return { res, json };
}

export async function postProjectTaskDraftCreate(
  projectId: string,
  body: {
    specVersionId: string;
    title: string;
    nodeType?: "requirement" | "design" | "feature" | "task";
    description?: string | null;
    priority?: string;
    acceptanceCriteria?: string[];
    positionX?: number;
    positionY?: number;
    dependsOnIds?: string[];
    stage?: string;
  }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/task-drafts`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<TaskDraftDto>;
  return { res, json };
}

export async function postProjectTaskDraftsGenerate(
  projectId: string,
  body: {
    specVersionId?: string;
    model?: string;
    mode?: "initial" | "regenerate";
    generationMode?: "single_pass" | "legacy_pipeline";
    includeNonFunctionalRequirements?: boolean;
  }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/task-drafts/generate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{
    createdCount: number;
    supersededCount: number;
    model: string;
    usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null;
    graphAutoRepaired?: boolean;
    autoConfirmedTaskCount?: number;
    promotedDraftRows?: number;
    confirmedTaskIds?: string[];
  }>;
  return { res, json };
}

export async function postProjectTaskDraftsConfirm(
  projectId: string,
  body: { draftIds?: string[]; confirmAll?: boolean }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/task-drafts/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{ confirmedCount: number; taskIds: string[] }>;
  return { res, json };
}

export async function patchProjectTaskDraft(
  projectId: string,
  draftId: string,
  body: Partial<{
    title: string;
    nodeType: "requirement" | "design" | "feature" | "task";
    description: string | null;
    priority: string;
    dependsOn: string[];
    dependsOnIds: string[];
    acceptanceCriteria: string[];
    taskInput: string | null;
    taskOutput: string | null;
    estimatedSize: string | null;
    executionKind: string | null;
    positionX: number;
    positionY: number;
    stage: string;
  }>
) {
  const encoded = encodeURIComponent(projectId);
  const did = encodeURIComponent(draftId);
  const res = await fetch(`/api/projects/${encoded}/task-drafts/${did}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<TaskDraftDto>;
  return { res, json };
}

export async function deleteProjectTaskDraft(projectId: string, draftId: string) {
  const encoded = encodeURIComponent(projectId);
  const did = encodeURIComponent(draftId);
  const res = await fetch(`/api/projects/${encoded}/task-drafts/${did}`, {
    method: "DELETE",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<unknown>;
  return { res, json };
}

export type CursorApiValidationStageDto =
  | "config"
  | "connectivity"
  | "auth"
  | "readiness"
  | "repo_access";

export type CursorApiValidationPayload = {
  overallOk: boolean;
  stages: Array<{
    stage: CursorApiValidationStageDto;
    status: "pass" | "fail" | "skip";
    reason?: string;
    latencyMs?: number;
    detail?: string;
    context?: { displayRepo: string; baseBranch: string };
  }>;
  summaryKr: string;
  detailLines: string[];
};

export type ExecutionSetupDto = {
  id: string;
  projectId: string;
  gitRepoUrl: string;
  gitRepoProvider: string;
  gitRepoName: string | null;
  baseBranch: string;
  branchStrategy: "feature-per-workflow" | "feature-per-task" | "manual";
  branchPrefix: string | null;
  githubAccessTokenMasked?: string | null;
  hasGithubAccessToken?: boolean;
  githubAuthConnectionOk?: boolean | null;
  githubAuthValidatedAt?: string | null;
  githubAuthValidationError?: string | null;
  githubCapabilityValidation?: GithubCapabilityValidationSnapshot | null;
  cursorApiUrl: string;
  cursorApiTokenMasked: string | null;
  hasCursorToken: boolean;
  workspacePath: string;
  allowedPathGlobs?: string[];
  autoCommit: boolean;
  autoPush: boolean;
  autoPr: boolean;
  requireApprovalBeforeApply: boolean;
  requireTestsBeforePush: boolean;
  dryRunAllowed: boolean;
  autoAdvanceToNextTask: boolean;
  maxAutoRetriesPerTask: number;
  stopOnTestFailure: boolean;
  stopOnRepeatedFailure: boolean;
  stopOnOutOfScopeChange: boolean;
  requireApprovalForSensitiveTasks: boolean;
  status: "draft" | "validated" | "invalid";
  lastValidatedAt: string | null;
  /** 구 서버 호환: 없으면 false로 간주 */
  needsRevalidation?: boolean;
  lastValidationError?: string | null;
  repoConnectionOk?: boolean | null;
  repoValidatedAt?: string | null;
  repoValidationError?: string | null;
  cursorApiConnectionOk?: boolean | null;
  cursorApiValidatedAt?: string | null;
  cursorApiValidationError?: string | null;
  executorConnectionOk?: boolean | null;
  executorValidatedAt?: string | null;
  executorValidationError?: string | null;
  /** 검증 API 응답을 병합한 클라이언트 전용(조회 API에는 없음) */
  cursorApiValidation?: CursorApiValidationPayload | null;
  updatedAt: string;
};

export async function fetchExecutionSetup(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/execution-setup`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<ExecutionSetupDto | null>;
  return { res, json };
}

export async function patchExecutionSetup(
  projectId: string,
  body: Partial<{
    gitRepoUrl: string;
    gitRepoProvider?: string;
    gitRepoName: string | null;
    baseBranch: string;
    branchStrategy: "feature-per-workflow" | "feature-per-task" | "manual";
    branchPrefix: string | null;
    cursorApiUrl: string;
    cursorApiToken: string | null;
    githubAccessToken: string | null;
    workspacePath: string;
    allowedPathGlobs?: string[];
    autoCommit: boolean;
    autoPush: boolean;
    autoPr: boolean;
    requireApprovalBeforeApply: boolean;
    requireTestsBeforePush: boolean;
    dryRunAllowed: boolean;
    autoAdvanceToNextTask: boolean;
    maxAutoRetriesPerTask: number;
    stopOnTestFailure: boolean;
    stopOnRepeatedFailure?: boolean;
    stopOnOutOfScopeChange?: boolean;
    requireApprovalForSensitiveTasks?: boolean;
  }>
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/execution-setup`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<ExecutionSetupDto>;
  return { res, json };
}

export async function postExecutionSetupValidate(
  projectId: string,
  body?: { scope?: "repository" | "github_auth" | "cursor_api" | "cursor_execution" | "cursor" | "all" }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/execution-setup/validate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body?.scope ? { scope: body.scope } : {}),
  });
  const json = (await res.json()) as ApiResponse<{
    scope?: "repository" | "github_auth" | "cursor_api" | "cursor_execution" | "cursor" | "all";
    status: "draft" | "validated" | "invalid";
    lastValidatedAt: string | null;
    needsRevalidation?: boolean;
    lastValidationError?: string | null;
    git: "ok" | "needs" | "error";
    cursor: "ok" | "needs" | "error";
    cursorApi?: "ok" | "needs" | "error";
    messages: string[];
    probeGitOk?: boolean;
    probeCursorOk?: boolean;
    repoConnectionOk?: boolean | null;
    cursorApiConnectionOk?: boolean | null;
    executorConnectionOk?: boolean | null;
    repoValidatedAt?: string | null;
    cursorApiValidatedAt?: string | null;
    executorValidatedAt?: string | null;
    repoValidationError?: string | null;
    cursorApiValidationError?: string | null;
    executorValidationError?: string | null;
    cursorApiValidation?: CursorApiValidationPayload;
    githubCapabilityValidation?: GithubCapabilityValidationSnapshot | null;
    repoAccessOk?: boolean | null;
    prReadOk?: boolean | null;
    prCreateOk?: boolean | null;
    prMergeOk?: boolean | null;
    githubOperableOk?: boolean | null;
    acceptedPermissionsHeader?: string | null;
    canonicalRepoGetAcceptedPermissions?: string | null;
    tokenMismatchHintKr?: string | null;
    tokenSourceUsed?: string | null;
    validationEpoch?: number | null;
    lastHttpStatus?: number | null;
    lastErrorMessage?: string | null;
  }>;
  return { res, json };
}

/** 프로젝트 소유자만 저장된 Cursor API 키 전체를 일시 확인합니다. */
export async function postRevealCursorApiToken(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/execution-setup/cursor-token/reveal`, {
    method: "POST",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<{ plaintext: string }>;
  return { res, json };
}

/** 프로젝트 소유자만 저장된 GitHub 토큰 전체를 일시 확인합니다. */
export async function postRevealGithubAccessToken(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/execution-setup/github-token/reveal`, {
    method: "POST",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<{ plaintext: string }>;
  return { res, json };
}

export async function postExecutionLoopRun(
  projectId: string,
  body?: { action?: "pause" | "resume"; taskId?: string }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/execution-loop`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json()) as ApiResponse<{ steps?: unknown[] }>;
  return { res, json };
}

export async function fetchExecutionLoopStatus(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/execution-loop`, {
    method: "GET",
    credentials: "include",
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
};

export async function fetchEnvironmentTestLast(projectId: string, opts?: { stage?: 2 }) {
  const encoded = encodeURIComponent(projectId);
  const q = opts?.stage === 2 ? "?stage=2" : "";
  const res = await fetch(`/api/projects/${encoded}/environment-test${q}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<{ last: EnvironmentTestLastDto | null }>;
  return { res, json };
}

export async function postEnvironmentTestRun(projectId: string, opts?: { stage?: 2 }) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/environment-test`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts?.stage === 2 ? { stage: 2 } : {}),
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
  const res = await fetch(`/api/projects/${encoded}/stage2-default-ai-members`, {
    method: "POST",
    credentials: "include",
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

export type TaskExecutionRunDto = {
  id: string;
  projectId: string;
  taskId: string;
  status: string;
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
  const res = await fetch(`/api/projects/${encoded}/execution-runs${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<TaskExecutionRunDto[]>;
  return { res, json };
}

/** GET /api/project-spec/context */
export type ProjectSpecContextDto = {
  projectId: string;
  name: string;
  description: string | null;
  projectType: string;
  coreGoals: string | null;
  inScope: string | null;
  outOfScope: string | null;
  targetUsers: string | null;
  successCriteria: string | null;
  executionPlanMarkdown: string | null;
  selectedPlanCandidateId: string | null;
};

export async function fetchProjectSpecContext(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/project-spec/context?projectId=${encoded}`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<ProjectSpecContextDto>;
  return { res, json };
}

export async function patchProjectSpecContext(body: {
  projectId: string;
  name?: string;
  description?: string | null;
  projectType?: string;
  coreGoals?: string | null;
  inScope?: string | null;
  outOfScope?: string | null;
  targetUsers?: string | null;
  successCriteria?: string | null;
  executionPlanMarkdown?: string | null;
  selectedPlanCandidateId?: string | null;
}) {
  const res = await fetch("/api/project-spec/context", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<ProjectSpecContextDto>;
  return { res, json };
}

export type ProjectTaskPromptDto = {
  taskPrompt: string | null;
  defaultPrompt: string;
};

export async function fetchProjectTaskPrompt(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/task-prompt`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<ProjectTaskPromptDto>;
  return { res, json };
}

export async function patchProjectTaskPrompt(projectId: string, body: { taskPrompt: string }) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/task-prompt`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{ taskPrompt: string | null }>;
  return { res, json };
}

/** F-1-3-5 단일 호출 Task 생성용 템플릿 */
export type ProjectTaskGenerationPromptDto = {
  taskGenerationPrompt: string | null;
  defaultPrompt: string;
};

export async function fetchProjectTaskGenerationPrompt(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/task-generation-prompt`, { credentials: "include" });
  const json = (await res.json()) as ApiResponse<ProjectTaskGenerationPromptDto>;
  return { res, json };
}

export async function patchProjectTaskGenerationPrompt(
  projectId: string,
  body: { taskGenerationPrompt: string }
) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/task-generation-prompt`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{ taskGenerationPrompt: string | null }>;
  return { res, json };
}

export type GenerateSpecContextResponse = {
  projectId: string;
  coreGoals: string;
  inScope: string[];
  outOfScope: string[];
  targetUsers: string[];
  successCriteria: string[];
  formatted: {
    specCoreGoals: string;
    specScopeIn: string;
    specScopeOut: string;
    specTargetUsers: string;
    specSuccessCriteria: string;
  };
};

export async function postGenerateSpecContext(body: {
  projectId: string;
  name: string;
  description: string;
  projectType: string;
}) {
  const res = await fetch("/api/project-spec/context/generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<GenerateSpecContextResponse>;
  return { res, json };
}

/** 전체 문서 후보 (모델별 비교) */
export type AiDraftCandidate = {
  id: string;
  modelId: string;
  content: string;
  createdAt: string;
};

export async function postProjectPlanGenerate(body: {
  projectId: string;
  name: string;
  description: string;
  projectType: string;
  models: string[];
}) {
  const res = await fetch("/api/project-spec/project-plan/generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{
    candidates: AiDraftCandidate[];
    failures: Array<{ modelId: string; message: string }>;
  }>;
  return { res, json };
}

export async function postProjectPlanRevise(body: {
  projectId: string;
  document: string;
  instruction?: string;
  model: string;
}) {
  const res = await fetch("/api/project-spec/project-plan/revise", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiResponse<{
    content: string;
    model: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  }>;
  return { res, json };
}
