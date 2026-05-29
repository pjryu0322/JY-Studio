import {
  getCursorBridgeAvailability,
  resolveCursorBridgeCloneRoot,
  type CursorBridgeRuntimeMode,
} from "@/lib/prototype/cursorBridgeRuntime";
import {
  resolveProjectTargetRepositoryFromExecutionSetup,
  type ProjectTargetRepository,
} from "@/lib/prototype/projectTargetRepository";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";

export type CursorExecutionMode = "cursor_api" | "http_bridge" | "local_runner" | "none";

export type CursorExecutionAvailabilityStatus =
  | "ready"
  | "missing_git_repo"
  | "missing_workspace"
  | "missing_cursor_api"
  | "missing_cursor_token"
  | "configured_but_unverified"
  | "disabled"
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
  readonly httpBridgeEndpoint?: string;
}>;

function envRecord(input?: Record<string, string | undefined>): Record<string, string | undefined> {
  if (input) return input;
  if (typeof process !== "undefined" && process.env) {
    return process.env as Record<string, string | undefined>;
  }
  return {};
}

function isTruthyEnv(value: string | undefined): boolean {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function resolveSetupCursorToken(setup: ExecutionSetupSourceGenerationRow | null | undefined): boolean {
  return setup?.hasCursorToken === true || Boolean(String(setup?.cursorApiToken ?? "").trim());
}

function resolveSetupGithubToken(setup: ExecutionSetupSourceGenerationRow | null | undefined): boolean {
  return (
    setup?.hasGithubAccessToken === true || Boolean(String(setup?.githubAccessToken ?? "").trim())
  );
}

function mapBridgeRuntimeMode(mode: CursorBridgeRuntimeMode): CursorExecutionMode {
  if (mode === "http") return "http_bridge";
  if (mode === "local_cli") return "local_runner";
  return "none";
}

export function evaluateCursorExecutionAvailability(input?: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
  readonly env?: Record<string, string | undefined>;
}): CursorExecutionAvailability {
  const env = envRecord(input?.env);
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
  const workspacePath =
    String(setup?.workspacePath ?? "").trim() ||
    resolveCursorBridgeCloneRoot(env) ||
    undefined;
  const hasWorkspace = Boolean(workspacePath);

  if (hasCursorApiUrl || hasCursorToken) {
    if (!hasCursorApiUrl) {
      return {
        mode: "cursor_api",
        status: "missing_cursor_api",
        ready: false,
        reason: "Cursor API URL이 없습니다. 환경설정에서 Cursor API URL을 저장해 주세요.",
        hasCursorApiUrl: false,
        hasCursorToken,
        hasGitRepo,
        hasWorkspace,
        hasGithubToken,
        ...(targetRepository ? { targetRepository } : {}),
        ...(workspacePath ? { workspacePath } : {}),
      };
    }
    if (!hasCursorToken) {
      return {
        mode: "cursor_api",
        status: "missing_cursor_token",
        ready: false,
        reason: "Cursor API Token이 없습니다. 환경설정에서 Cursor API 키를 저장해 주세요.",
        hasCursorApiUrl: true,
        hasCursorToken: false,
        hasGitRepo,
        hasWorkspace,
        hasGithubToken,
        cursorApiUrl: String(setup!.cursorApiUrl).trim(),
        ...(targetRepository ? { targetRepository } : {}),
        ...(workspacePath ? { workspacePath } : {}),
      };
    }
    if (!hasGitRepo) {
      return {
        mode: "cursor_api",
        status: "missing_git_repo",
        ready: false,
        reason: "Git 저장소 설정이 없습니다. 환경설정에서 Git 저장소를 저장해 주세요.",
        hasCursorApiUrl: true,
        hasCursorToken: true,
        hasGitRepo: false,
        hasWorkspace,
        hasGithubToken,
        cursorApiUrl: String(setup!.cursorApiUrl).trim(),
        ...(workspacePath ? { workspacePath } : {}),
      };
    }
    if (!hasWorkspace) {
      return {
        mode: "cursor_api",
        status: "missing_workspace",
        ready: false,
        reason: "workspacePath가 없습니다. 환경설정에서 작업 경로를 저장해 주세요.",
        hasCursorApiUrl: true,
        hasCursorToken: true,
        hasGitRepo: true,
        hasWorkspace: false,
        hasGithubToken,
        cursorApiUrl: String(setup!.cursorApiUrl).trim(),
        targetRepository: targetRepository!,
      };
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
      cursorApiUrl: String(setup!.cursorApiUrl).trim(),
      targetRepository: targetRepository!,
      workspacePath,
    };
  }

  const bridge = getCursorBridgeAvailability({ env });
  if (bridge.available && bridge.mode === "http" && bridge.endpoint) {
    return {
      mode: "http_bridge",
      status: "ready",
      ready: true,
      reason: bridge.reason,
      hasCursorApiUrl: false,
      hasCursorToken: false,
      hasGitRepo,
      hasWorkspace,
      hasGithubToken,
      httpBridgeEndpoint: bridge.endpoint,
      ...(workspacePath ? { workspacePath } : {}),
      ...(targetRepository ? { targetRepository } : {}),
    };
  }
  if (bridge.available && bridge.mode === "local_cli") {
    return {
      mode: "local_runner",
      status: "configured_but_unverified",
      ready: true,
      reason: bridge.reason,
      hasCursorApiUrl: false,
      hasCursorToken: false,
      hasGitRepo,
      hasWorkspace,
      hasGithubToken,
      ...(workspacePath ? { workspacePath } : {}),
      ...(targetRepository ? { targetRepository } : {}),
    };
  }
  if (bridge.status === "disabled" && !setup) {
    return {
      mode: "none",
      status: "disabled",
      ready: false,
      reason: "Cursor 실행 설정이 없습니다. 환경설정 또는 서버 Bridge env를 구성해 주세요.",
      hasCursorApiUrl: false,
      hasCursorToken: false,
      hasGitRepo,
      hasWorkspace,
      hasGithubToken,
    };
  }

  return {
    mode: mapBridgeRuntimeMode(bridge.mode),
    status: bridge.available ? "configured_but_unverified" : "disabled",
    ready: bridge.available,
    reason: bridge.reason,
    hasCursorApiUrl,
    hasCursorToken,
    hasGitRepo,
    hasWorkspace,
    hasGithubToken,
    ...(bridge.endpoint ? { httpBridgeEndpoint: bridge.endpoint } : {}),
    ...(workspacePath ? { workspacePath } : {}),
    ...(targetRepository ? { targetRepository } : {}),
  };
}

export function isCursorExecutionReady(input?: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
  readonly env?: Record<string, string | undefined>;
}): boolean {
  return evaluateCursorExecutionAvailability(input).ready;
}

export function formatCursorExecutionAvailabilityDiagnosticLines(input?: {
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
  readonly env?: Record<string, string | undefined>;
}): readonly string[] {
  const availability = evaluateCursorExecutionAvailability(input);
  const env = envRecord(input?.env);
  const setup = input?.setup ?? null;
  const pushLabel =
    setup?.autoPush === true
      ? "autoPush=on"
      : isTruthyEnv(env.GIT_APPLY_PUSH_ENABLED)
        ? "env push enabled"
        : "autoPush=off";

  return [
    "Cursor 실행 설정:",
    `- Mode: ${availability.mode}`,
    `- Status: ${availability.status}`,
    `- Cursor API: ${availability.hasCursorApiUrl && availability.hasCursorToken ? "설정됨" : "미설정"}`,
    `- Cursor Token: ${availability.hasCursorToken ? "설정됨" : "미설정"}`,
    `- Git 저장소: ${availability.hasGitRepo ? "설정됨" : "미설정"}`,
    `- Workspace: ${availability.hasWorkspace ? "설정됨" : "미설정"}`,
    `- GitHub Token: ${availability.hasGithubToken ? "설정됨" : "미설정"}`,
    `- Push: ${pushLabel}`,
    ...(availability.httpBridgeEndpoint
      ? [`- HTTP Bridge endpoint: ${availability.httpBridgeEndpoint}`]
      : []),
    ...(availability.ready ? [] : [`- 안내: ${availability.reason}`]),
  ];
}

export const CURSOR_API_NOT_CONFIGURED_MESSAGE =
  "Cursor API 설정이 없습니다.\n환경설정에서 Cursor API URL과 키를 저장해 주세요." as const;

export const CURSOR_API_UNSUPPORTED_MESSAGE =
  "Cursor API 직접 실행 endpoint가 지원되지 않습니다.\n현재 Cursor API가 외부 소스 생성 요청을 받을 수 있는지 확인이 필요합니다." as const;

export const CURSOR_API_TOKEN_MISSING_MESSAGE =
  "Cursor API Token을 읽을 수 없습니다.\n환경설정에서 Cursor API 키를 다시 저장해 주세요." as const;
