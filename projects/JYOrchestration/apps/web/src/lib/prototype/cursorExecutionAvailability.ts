import {
  DEFAULT_CURSOR_API_BASE,
  normalizeCursorApiBaseUrl,
} from "@/lib/executionSetup/cursorApiValidation";
import {
  resolveProjectTargetRepositoryFromExecutionSetup,
  type ProjectTargetRepository,
} from "@/lib/prototype/projectTargetRepository";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  DETERMINISTIC_PLATFORM_TIMELINE_META,
  withDeterministicPlatformTimelineMeta,
} from "@/lib/requirements/promptTimelineState";

export type CursorExecutionMode = "cursor_api" | "none";

export type CursorExecutionAvailabilityStatus =
  | "ready"
  | "missing_git_repo"
  | "missing_workspace"
  | "missing_cursor_api"
  | "missing_cursor_api_url"
  | "missing_cursor_token"
  | "configured_but_unverified"
  | "unsupported";

export type CursorExecutionAvailability = Readonly<{
  readonly mode: CursorExecutionMode;
  readonly status: CursorExecutionAvailabilityStatus;
  readonly ready: boolean;
  readonly reason: string;
  readonly hasCursorApiUrl: boolean;
  readonly usesDefaultCursorApiUrl: boolean;
  readonly hasCursorToken: boolean;
  readonly hasGitRepo: boolean;
  readonly hasWorkspace: boolean;
  readonly hasGithubToken: boolean;
  readonly targetRepository?: ProjectTargetRepository;
  readonly workspacePath?: string;
  readonly cursorApiUrl?: string;
}>;

function resolveSetupCursorToken(setup: ExecutionSetupSourceGenerationRow | null | undefined): boolean {
  return setup?.hasCursorToken === true || Boolean(String(setup?.cursorApiToken ?? "").trim());
}

function resolveSetupGithubToken(setup: ExecutionSetupSourceGenerationRow | null | undefined): boolean {
  return (
    setup?.hasGithubAccessToken === true || Boolean(String(setup?.githubAccessToken ?? "").trim())
  );
}

export function resolveEffectiveCursorApiUrlFromSetup(
  setup: ExecutionSetupSourceGenerationRow | null | undefined,
): Readonly<{ readonly url?: string; readonly usesDefault: boolean }> {
  if (!setup) return { usesDefault: false };
  const explicit = String(setup.cursorApiUrl ?? "").trim();
  if (explicit) {
    return { url: normalizeCursorApiBaseUrl(explicit), usesDefault: false };
  }
  if (resolveSetupCursorToken(setup)) {
    return { url: DEFAULT_CURSOR_API_BASE, usesDefault: true };
  }
  return { usesDefault: false };
}

function missingAvailability(input: {
  readonly status: CursorExecutionAvailabilityStatus;
  readonly reason: string;
  readonly hasCursorApiUrl: boolean;
  readonly usesDefaultCursorApiUrl: boolean;
  readonly hasCursorToken: boolean;
  readonly hasGitRepo: boolean;
  readonly hasWorkspace: boolean;
  readonly hasGithubToken: boolean;
  readonly targetRepository?: ProjectTargetRepository;
  readonly workspacePath?: string;
  readonly cursorApiUrl?: string;
}): CursorExecutionAvailability {
  return {
    mode: "none",
    ready: false,
    ...input,
  };
}

export function evaluateCursorExecutionAvailability(input?: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
}): CursorExecutionAvailability {
  const setup = input?.setup ?? null;
  const hasCursorToken = resolveSetupCursorToken(setup);
  const hasGithubToken = resolveSetupGithubToken(setup);
  const targetRepository = setup
    ? resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: setup.gitRepoUrl,
        gitRepoName: setup.gitRepoName,
        gitRepoProvider: setup.gitRepoProvider,
        baseBranch: setup.baseBranch,
      })
    : null;
  const hasGitRepo = Boolean(targetRepository);
  const workspacePath = String(setup?.workspacePath ?? "").trim() || undefined;
  const hasWorkspace = Boolean(workspacePath);
  const effectiveApi = resolveEffectiveCursorApiUrlFromSetup(setup);
  const hasCursorApiUrl = Boolean(effectiveApi.url);
  const partialBase = {
    hasCursorApiUrl,
    usesDefaultCursorApiUrl: effectiveApi.usesDefault,
    hasCursorToken,
    hasGitRepo,
    hasWorkspace,
    hasGithubToken,
    ...(targetRepository ? { targetRepository } : {}),
    ...(workspacePath ? { workspacePath } : {}),
    ...(effectiveApi.url ? { cursorApiUrl: effectiveApi.url } : {}),
  };

  if (!setup) {
    return missingAvailability({
      status: "missing_cursor_api",
      reason: "환경설정에서 Cursor API URL과 키를 저장해 주세요.",
      hasCursorApiUrl: false,
      usesDefaultCursorApiUrl: false,
      hasCursorToken: false,
      hasGitRepo: false,
      hasWorkspace: false,
      hasGithubToken: false,
    });
  }

  if (!hasCursorToken) {
    return missingAvailability({
      status: "missing_cursor_token",
      reason: "환경설정에서 Cursor API 키를 저장해 주세요.",
      ...partialBase,
      hasCursorApiUrl: Boolean(String(setup.cursorApiUrl ?? "").trim()),
      usesDefaultCursorApiUrl: false,
    });
  }

  if (!hasCursorApiUrl) {
    return missingAvailability({
      status: "missing_cursor_api_url",
      reason: "환경설정에서 Cursor API URL을 저장해 주세요.",
      ...partialBase,
      hasCursorApiUrl: false,
      usesDefaultCursorApiUrl: false,
    });
  }

  if (!hasGitRepo) {
    return missingAvailability({
      status: "missing_git_repo",
      reason: "Git 저장소 설정이 없습니다. 환경설정에서 Git 저장소를 저장해 주세요.",
      ...partialBase,
    });
  }

  if (!hasWorkspace) {
    return missingAvailability({
      status: "missing_workspace",
      reason: "workspacePath가 없습니다. 환경설정에서 작업 경로를 저장해 주세요.",
      ...partialBase,
    });
  }

  return {
    mode: "cursor_api",
    status: "ready",
    ready: true,
    reason: "ExecutionSetup Cursor API 직접 호출 모드가 준비되었습니다.",
    ...partialBase,
    targetRepository: targetRepository!,
  };
}

export function isCursorExecutionReady(input?: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
}): boolean {
  return evaluateCursorExecutionAvailability(input).ready;
}

export function formatCursorExecutionAvailabilityDiagnosticLines(input?: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
}): readonly string[] {
  const availability = evaluateCursorExecutionAvailability(input);
  const setup = input?.setup ?? null;
  const pushLabel = setup?.autoPush === true ? "autoPush=on" : "autoPush=off";
  const cursorApiUrlLabel = availability.usesDefaultCursorApiUrl
    ? "기본값 사용"
    : availability.hasCursorApiUrl
      ? "설정됨"
      : "미설정";

  return [
    "Cursor 실행 설정:",
    `- Mode: ${availability.mode}`,
    `- Status: ${availability.status}`,
    `- Cursor API URL: ${cursorApiUrlLabel}`,
    `- Cursor API Key: ${availability.hasCursorToken ? "설정됨" : "미설정"}`,
    `- Git 저장소: ${availability.hasGitRepo ? "설정됨" : "미설정"}`,
    `- Workspace: ${availability.hasWorkspace ? "설정됨" : "미설정"}`,
    `- GitHub Token: ${availability.hasGithubToken ? "설정됨" : "미설정"}`,
    `- Push: ${pushLabel}`,
    ...(availability.ready ? [] : [`- 안내: ${availability.reason}`]),
  ];
}

export type ExecutionSetupAvailabilityTimelineAction =
  | "execution_setup_loaded_for_implementation_board"
  | "execution_setup_missing_for_implementation_board"
  | "execution_setup_saved_and_board_refreshed"
  | "execution_setup_availability_computed"
  | "execution_setup_availability_mismatch_detected"
  | "cursor_api_key_present_url_missing";

export function buildExecutionSetupAvailabilityFingerprint(input: {
  readonly projectId: string;
  readonly action: ExecutionSetupAvailabilityTimelineAction;
  readonly source?: string;
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
}): string {
  const availability = evaluateCursorExecutionAvailability({ setup: input.setup });
  return [
    input.projectId,
    input.action,
    input.source ?? "",
    availability.status,
    Boolean(input.setup),
    availability.hasGitRepo,
    availability.hasGithubToken,
    availability.hasCursorApiUrl,
    availability.hasCursorToken,
    availability.hasWorkspace,
    availability.usesDefaultCursorApiUrl,
  ].join("|");
}

export function buildExecutionSetupAvailabilityTimelineEntry(input: {
  readonly action: ExecutionSetupAvailabilityTimelineAction;
  readonly projectId: string;
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
  readonly source?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const availability = evaluateCursorExecutionAvailability({ setup: input.setup });
  const effectiveApi = resolveEffectiveCursorApiUrlFromSetup(input.setup);
  return withDeterministicPlatformTimelineMeta({
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: DETERMINISTIC_PLATFORM_TIMELINE_META.source,
    provider: DETERMINISTIC_PLATFORM_TIMELINE_META.provider,
    model: DETERMINISTIC_PLATFORM_TIMELINE_META.model,
    responseText: [
      `type=${input.action}`,
      `projectId=${input.projectId}`,
      `hasSetup=${Boolean(input.setup)}`,
      `hasGitRepo=${availability.hasGitRepo}`,
      `hasGithubToken=${availability.hasGithubToken}`,
      `hasCursorApiUrl=${availability.hasCursorApiUrl}`,
      `hasCursorToken=${availability.hasCursorToken}`,
      `hasWorkspace=${availability.hasWorkspace}`,
      `availabilityStatus=${availability.status}`,
      `usesDefaultCursorApiUrl=${availability.usesDefaultCursorApiUrl}`,
      ...(input.source ? [`source=${input.source}`] : []),
      ...(effectiveApi.usesDefault && !String(input.setup?.cursorApiUrl ?? "").trim()
        ? ["cursorApiKeyPresentUrlMissing=true"]
        : []),
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  });
}

export const CURSOR_API_NOT_CONFIGURED_MESSAGE =
  "Cursor API 설정이 없습니다.\n환경설정에서 Cursor API URL과 키를 저장해 주세요." as const;

export const CURSOR_API_UNSUPPORTED_MESSAGE =
  "Cursor API 직접 실행 endpoint가 지원되지 않습니다.\n현재 Cursor API가 외부 소스 생성 요청을 받을 수 있는지 확인이 필요합니다." as const;

export const CURSOR_API_TOKEN_MISSING_MESSAGE =
  "Cursor API 키를 불러올 수 없습니다.\n환경설정에서 Cursor API 키를 다시 저장해 주세요." as const;
