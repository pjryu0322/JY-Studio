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
    | { action: "aiRequest"; model?: string }
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
  body: { specVersionId?: string; model?: string; mode?: "initial" | "regenerate" }
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
  }>;
  return { res, json };
}

export async function postProjectTaskDraftsAiReorder(projectId: string, body?: { model?: string }) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/task-drafts/ai-reorder`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json()) as ApiResponse<{
    model: string;
    usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null;
    cycleDetected: boolean;
    reason?: string;
    parallelGroups?: string[][];
    cycleProblemEdge?: { source: string; target: string } | null;
    cycleCandidateEdges?: Array<{ source: string; target: string }>;
    tasks: Array<{
      id: string;
      dependsOnIds?: string[];
      positionX: number;
      positionY: number;
    }>;
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

export type ExecutionSetupDto = {
  id: string;
  projectId: string;
  gitRepoUrl: string;
  gitRepoName: string | null;
  baseBranch: string;
  branchStrategy: "feature-per-workflow" | "feature-per-task" | "manual";
  branchPrefix: string | null;
  cursorApiUrl: string;
  cursorApiTokenMasked: string | null;
  hasCursorToken: boolean;
  workspacePath: string;
  projectRootPath: string;
  autoCommit: boolean;
  autoPush: boolean;
  autoPr: boolean;
  requireApprovalBeforeApply: boolean;
  requireTestsBeforePush: boolean;
  dryRunAllowed: boolean;
  status: "draft" | "validated" | "invalid";
  lastValidatedAt: string | null;
  /** 구 서버 호환: 없으면 false로 간주 */
  needsRevalidation?: boolean;
  lastValidationError?: string | null;
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
    gitRepoName: string | null;
    baseBranch: string;
    branchStrategy: "feature-per-workflow" | "feature-per-task" | "manual";
    branchPrefix: string | null;
    cursorApiUrl: string;
    cursorApiToken: string | null;
    workspacePath: string;
    projectRootPath: string;
    autoCommit: boolean;
    autoPush: boolean;
    autoPr: boolean;
    requireApprovalBeforeApply: boolean;
    requireTestsBeforePush: boolean;
    dryRunAllowed: boolean;
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

export async function postExecutionSetupValidate(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await fetch(`/api/projects/${encoded}/execution-setup/validate`, {
    method: "POST",
    credentials: "include",
  });
  const json = (await res.json()) as ApiResponse<{
    status: "draft" | "validated" | "invalid";
    lastValidatedAt: string | null;
    needsRevalidation?: boolean;
    lastValidationError?: string | null;
    git: "ok" | "needs" | "error";
    cursor: "ok" | "needs" | "error";
    messages: string[];
    probeGitOk?: boolean;
    probeCursorOk?: boolean;
  }>;
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
