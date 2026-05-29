import {
  resolveProjectTargetRepositoryFromExecutionSetup,
  type ProjectTargetRepository,
} from "@/lib/prototype/projectTargetRepository";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";

export type CursorExecutionMode = "cursor_api" | "none";

export type CursorExecutionAvailabilityStatus =
  | "ready"
  | "missing_git_repo"
  | "missing_workspace"
  | "missing_cursor_api"
  | "missing_cursor_token"
  | "configured_but_unverified"
  | "unsupported";

export type CursorExecutionAvailability = Readonly<{
  readonly mode: CursorExecutionMode;
  readonly status: CursorExecutionAvailabilityStatus;
  readonly ready: boolean;
  readonly reason: string;
  readonly hasCursorApiUrl: boolean;
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

function missingAvailability(input: {
  readonly status: CursorExecutionAvailabilityStatus;
  readonly reason: string;
  readonly hasCursorApiUrl: boolean;
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
  const hasCursorApiUrl = Boolean(String(setup?.cursorApiUrl ?? "").trim());
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

  if (!setup || !hasCursorApiUrl) {
    return missingAvailability({
      status: "missing_cursor_api",
      reason: "환경설정에서 Cursor API URL과 키를 저장해 주세요.",
      hasCursorApiUrl: false,
      hasCursorToken,
      hasGitRepo,
      hasWorkspace,
      hasGithubToken,
      ...(targetRepository ? { targetRepository } : {}),
      ...(workspacePath ? { workspacePath } : {}),
    });
  }

  if (!hasCursorToken) {
    return missingAvailability({
      status: "missing_cursor_token",
      reason: "환경설정에서 Cursor API 키를 저장해 주세요.",
      hasCursorApiUrl: true,
      hasCursorToken: false,
      hasGitRepo,
      hasWorkspace,
      hasGithubToken,
      cursorApiUrl: String(setup.cursorApiUrl).trim(),
      ...(targetRepository ? { targetRepository } : {}),
      ...(workspacePath ? { workspacePath } : {}),
    });
  }

  if (!hasGitRepo) {
    return missingAvailability({
      status: "missing_git_repo",
      reason: "Git 저장소 설정이 없습니다. 환경설정에서 Git 저장소를 저장해 주세요.",
      hasCursorApiUrl: true,
      hasCursorToken: true,
      hasGitRepo: false,
      hasWorkspace,
      hasGithubToken,
      cursorApiUrl: String(setup.cursorApiUrl).trim(),
      ...(workspacePath ? { workspacePath } : {}),
    });
  }

  if (!hasWorkspace) {
    return missingAvailability({
      status: "missing_workspace",
      reason: "workspacePath가 없습니다. 환경설정에서 작업 경로를 저장해 주세요.",
      hasCursorApiUrl: true,
      hasCursorToken: true,
      hasGitRepo: true,
      hasWorkspace: false,
      hasGithubToken,
      cursorApiUrl: String(setup.cursorApiUrl).trim(),
      targetRepository: targetRepository!,
    });
  }

  return {
    mode: "cursor_api",
    status: "ready",
    ready: true,
    reason: "ExecutionSetup Cursor API 직접 호출 모드가 준비되었습니다.",
    hasCursorApiUrl: true,
    hasCursorToken: true,
    hasGitRepo: true,
    hasWorkspace: true,
    hasGithubToken,
    cursorApiUrl: String(setup.cursorApiUrl).trim(),
    targetRepository: targetRepository!,
    workspacePath,
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

  return [
    "Cursor 실행 설정:",
    `- Mode: ${availability.mode}`,
    `- Status: ${availability.status}`,
    `- Cursor API: ${availability.hasCursorApiUrl ? "설정됨" : "미설정"}`,
    `- Cursor Token: ${availability.hasCursorToken ? "설정됨" : "미설정"}`,
    `- Git 저장소: ${availability.hasGitRepo ? "설정됨" : "미설정"}`,
    `- Workspace: ${availability.hasWorkspace ? "설정됨" : "미설정"}`,
    `- GitHub Token: ${availability.hasGithubToken ? "설정됨" : "미설정"}`,
    `- Push: ${pushLabel}`,
    ...(availability.ready ? [] : [`- 안내: ${availability.reason}`]),
  ];
}

export const CURSOR_API_NOT_CONFIGURED_MESSAGE =
  "Cursor API 설정이 없습니다.\n환경설정에서 Cursor API URL과 키를 저장해 주세요." as const;

export const CURSOR_API_UNSUPPORTED_MESSAGE =
  "Cursor API 직접 실행 endpoint가 지원되지 않습니다.\n현재 Cursor API가 외부 소스 생성 요청을 받을 수 있는지 확인이 필요합니다." as const;

export const CURSOR_API_TOKEN_MISSING_MESSAGE =
  "Cursor API 키를 불러올 수 없습니다.\n환경설정에서 Cursor API 키를 다시 저장해 주세요." as const;
