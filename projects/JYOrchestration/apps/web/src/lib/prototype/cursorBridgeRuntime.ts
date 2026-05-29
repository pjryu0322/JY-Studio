export type CodeAgentBridgeProvider = "cursor";

export type CodeAgentBridgeAvailabilityStatus =
  | "available"
  | "missing_config"
  | "disabled"
  | "unsupported"
  | "unreachable";

export type CursorBridgeRuntimeMode = "http" | "local_cli" | "none";

export type CursorBridgeAvailability = Readonly<{
  readonly available: boolean;
  readonly status: CodeAgentBridgeAvailabilityStatus;
  readonly reason: string;
  readonly provider: CodeAgentBridgeProvider;
  readonly mode: CursorBridgeRuntimeMode;
  readonly endpoint?: string;
  readonly workspaceRoot?: string;
}>;

const JYO_ORCHESTRATION_PREFIX = "projects/JYOrchestration/";

export const DEFAULT_CURSOR_BRIDGE_ALLOWED_PATHS = [
  "projects/JYOrchestration/**",
] as const;

export const DEFAULT_CURSOR_BRIDGE_FORBIDDEN_PATHS = [
  "package.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  ".env",
  ".env.*",
] as const;

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

export function resolveCursorBridgeWorkspaceRoot(
  env: Record<string, string | undefined>,
): string | undefined {
  const root =
    String(env.CURSOR_WORKSPACE_ROOT ?? "").trim() ||
    String(env.CURSOR_WORKDIR ?? "").trim() ||
    String(env.GIT_APPLY_WORKDIR ?? "").trim();
  return root || undefined;
}

export function getCursorBridgeAvailability(input?: {
  readonly env?: Record<string, string | undefined>;
}): CursorBridgeAvailability {
  const env = envRecord(input?.env);
  const provider: CodeAgentBridgeProvider = "cursor";

  if (!isTruthyEnv(env.CURSOR_BRIDGE_ENABLED)) {
    return {
      available: false,
      status: "disabled",
      reason: "CURSOR_BRIDGE_ENABLED=true 로 설정해야 Cursor Bridge를 사용할 수 있습니다.",
      provider,
      mode: "none",
    };
  }

  const endpoint = String(env.CURSOR_BRIDGE_ENDPOINT ?? "").trim().replace(/\/+$/, "");
  const workspaceRoot = resolveCursorBridgeWorkspaceRoot(env);
  const cliPath = String(env.CURSOR_CLI_PATH ?? "").trim();
  const useLocal = isTruthyEnv(env.CURSOR_BRIDGE_USE_LOCAL) || !endpoint;

  if (endpoint) {
    return {
      available: true,
      status: "available",
      reason: "HTTP Cursor Bridge endpoint가 설정되었습니다.",
      provider,
      mode: "http",
      endpoint,
      ...(workspaceRoot ? { workspaceRoot } : {}),
    };
  }

  if (useLocal) {
    if (!workspaceRoot) {
      return {
        available: false,
        status: "missing_config",
        reason:
          "로컬 Cursor Bridge 실행에 workspace root가 필요합니다. CURSOR_WORKSPACE_ROOT 또는 GIT_APPLY_WORKDIR을 설정하세요.",
        provider,
        mode: "none",
      };
    }
    if (!cliPath) {
      return {
        available: false,
        status: "missing_config",
        reason:
          "로컬 Cursor Bridge 실행에 CURSOR_CLI_PATH가 필요합니다. Cursor CLI 경로를 환경 변수로 설정하세요.",
        provider,
        mode: "none",
        workspaceRoot,
      };
    }
    return {
      available: true,
      status: "available",
      reason: "로컬 Cursor CLI + Git worktree Bridge가 사용 가능합니다.",
      provider,
      mode: "local_cli",
      workspaceRoot,
    };
  }

  return {
    available: false,
    status: "missing_config",
    reason:
      "CURSOR_BRIDGE_ENDPOINT 또는 (CURSOR_WORKSPACE_ROOT + CURSOR_CLI_PATH) 로컬 Bridge 설정이 필요합니다.",
    provider,
    mode: "none",
  };
}

export function isCursorBridgeExecutionAvailable(input?: {
  readonly env?: Record<string, string | undefined>;
}): boolean {
  return getCursorBridgeAvailability(input).available;
}

export function isPathUnderJyOrchestration(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  return normalized === JYO_ORCHESTRATION_PREFIX.slice(0, -1) || normalized.startsWith(JYO_ORCHESTRATION_PREFIX);
}

export function formatCursorBridgeAvailabilityDiagnosticLines(input?: {
  readonly env?: Record<string, string | undefined>;
}): readonly string[] {
  const availability = getCursorBridgeAvailability(input);
  const pushEnabled = isTruthyEnv(envRecord(input?.env).GIT_APPLY_PUSH_ENABLED);
  return [
    "Cursor Bridge 설정:",
    `- Enabled: ${isTruthyEnv(envRecord(input?.env).CURSOR_BRIDGE_ENABLED) ? "yes" : "no"}`,
    `- Mode: ${availability.mode}`,
    `- Status: ${availability.status}`,
    `- Endpoint: ${availability.endpoint ?? "(없음)"}`,
    `- Workspace: ${availability.workspaceRoot ?? "(없음)"}`,
    `- Git push: ${pushEnabled ? "enabled" : "disabled (GIT_APPLY_PUSH_ENABLED)"}`,
    ...(availability.available ? [] : [`- 안내: ${availability.reason}`]),
  ];
}
