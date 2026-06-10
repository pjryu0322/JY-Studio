import type { ApiResponse } from "../types";
import type { GithubCapabilityValidationSnapshot } from "@/lib/executionSetup/githubPatCapabilityProbes";
import type { AutoGenerationSettingsConnectionTestResultV1 } from "@/lib/prototype/autoGenerationSettingsConnectionTest";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

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
  openaiPlannerApiKeyMasked?: string | null;
  hasOpenaiPlannerApiKey?: boolean;
  enableLlmCodeTaskRefinement?: boolean;
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
  /** 동일 소유자의 다른 프로젝트에서 마스킹된 힌트(현재 프로젝트에 토큰이 없을 때만 채워짐) */
  peerCredentialHints?: {
    githubAccessTokenMasked: string | null;
    cursorApiUrl: string | null;
    cursorApiTokenMasked: string | null;
  } | null;
};

/** GET: `data`가 null일 때도 동일 계정 peer 힌트가 올 수 있음 */
export type ExecutionSetupGetJson = ApiResponse<ExecutionSetupDto | null> & {
  peerCredentialHints?: ExecutionSetupDto["peerCredentialHints"] | null;
};

export async function fetchExecutionSetup(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/execution-setup`);
  const json = (await res.json()) as ExecutionSetupGetJson;
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
    openaiPlannerApiKey: string | null;
    enableLlmCodeTaskRefinement: boolean;
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
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/execution-setup`, {
    method: "PATCH",
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
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/execution-setup/validate`, {
    method: "POST",
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
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/execution-setup/cursor-token/reveal`, {
    method: "POST",
  });
  const json = (await res.json()) as ApiResponse<{ plaintext: string }>;
  return { res, json };
}

export async function postAutoGenerationTestConnection(
  projectId: string,
  options?: Readonly<{ readonly includePreviewPreflight?: boolean }>,
) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/auto-generation/test-connection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      includePreviewPreflight: options?.includePreviewPreflight === true,
    }),
  });
  const json = (await res.json()) as ApiResponse<AutoGenerationSettingsConnectionTestResultV1> & {
    ok?: boolean;
    autoGenerationReady?: boolean;
    previewDeploymentReady?: boolean;
    level?: string;
    basicConnection?: unknown;
    envcheck?: unknown;
    previewDeploymentPreflight?: unknown;
    userSummary?: string;
  };
  return { res, json };
}

/** 프로젝트 소유자만 저장된 GitHub 토큰 전체를 일시 확인합니다. */
export async function postRevealGithubAccessToken(projectId: string) {
  const encoded = encodeURIComponent(projectId);
  const res = await credentialsIncludeFetch(`/api/projects/${encoded}/execution-setup/github-token/reveal`, {
    method: "POST",
  });
  const json = (await res.json()) as ApiResponse<{ plaintext: string }>;
  return { res, json };
}
