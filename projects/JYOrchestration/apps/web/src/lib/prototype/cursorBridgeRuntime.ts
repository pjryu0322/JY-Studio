import { formatCursorExecutionAvailabilityDiagnosticLines } from "@/lib/prototype/cursorExecutionAvailability";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";

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

const PLATFORM_SOURCE_PREFIXES = [
  "projects/JYOrchestration/",
  "apps/web/src/generated/implementation-wip/",
] as const;

export const DEFAULT_CURSOR_BRIDGE_FORBIDDEN_PATHS = [
  "projects/JYOrchestration/**",
  "apps/web/src/generated/implementation-wip/**",
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

export function resolveCursorBridgeCloneRoot(env: Record<string, string | undefined>): string | undefined {
  const root =
    String(env.CURSOR_TARGET_REPO_CLONE_ROOT ?? "").trim() ||
    String(env.CURSOR_WORKSPACE_ROOT ?? "").trim() ||
    String(env.CURSOR_WORKDIR ?? "").trim() ||
    String(env.GIT_APPLY_WORKDIR ?? "").trim();
  return root || undefined;
}

/** @deprecated Use resolveCursorBridgeCloneRoot */
export function resolveCursorBridgeWorkspaceRoot(env: Record<string, string | undefined>): string | undefined {
  return resolveCursorBridgeCloneRoot(env);
}

export function isPlatformInternalSourcePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  return PLATFORM_SOURCE_PREFIXES.some(
    (prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix),
  );
}

/** @deprecated Use isPlatformInternalSourcePath */
export function isPathUnderJyOrchestration(relativePath: string): boolean {
  return isPlatformInternalSourcePath(relativePath);
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
  const cloneRoot = resolveCursorBridgeCloneRoot(env);
  const cliPath = String(env.CURSOR_CLI_PATH ?? "").trim();
  const runnerCommand = String(env.CODE_AGENT_RUNNER_COMMAND ?? "").trim();
  const useLocal = isTruthyEnv(env.CURSOR_BRIDGE_USE_LOCAL);

  if (endpoint) {
    return {
      available: true,
      status: "available",
      reason: "HTTP Cursor Bridge endpoint가 설정되었습니다.",
      provider,
      mode: "http",
      endpoint,
      ...(cloneRoot ? { workspaceRoot: cloneRoot } : {}),
    };
  }

  if (useLocal) {
    if (!cliPath && !runnerCommand) {
      return {
        available: false,
        status: "missing_config",
        reason:
          "로컬 Cursor Bridge 실행에 CURSOR_CLI_PATH 또는 CODE_AGENT_RUNNER_COMMAND가 필요합니다.",
        provider,
        mode: "none",
        ...(cloneRoot ? { workspaceRoot: cloneRoot } : {}),
      };
    }
    if (!cloneRoot) {
      return {
        available: false,
        status: "missing_config",
        reason:
          "대상 저장소 clone root가 필요합니다. CURSOR_TARGET_REPO_CLONE_ROOT 또는 GIT_APPLY_WORKDIR을 설정하세요.",
        provider,
        mode: "none",
      };
    }
    return {
      available: true,
      status: "available",
      reason: "로컬 Cursor CLI + 대상 Git 저장소 worktree Bridge가 사용 가능합니다.",
      provider,
      mode: "local_cli",
      workspaceRoot: cloneRoot,
    };
  }

  return {
    available: false,
    status: "missing_config",
    reason:
      "CURSOR_BRIDGE_ENDPOINT 또는 (CURSOR_BRIDGE_USE_LOCAL=true + CURSOR_CLI_PATH/CODE_AGENT_RUNNER_COMMAND + clone root) 설정이 필요합니다.",
    provider,
    mode: "none",
  };
}

export function isCursorBridgeExecutionAvailable(input?: {
  readonly env?: Record<string, string | undefined>;
}): boolean {
  return getCursorBridgeAvailability(input).available;
}

export function formatCursorBridgeAvailabilityDiagnosticLines(input?: {
  readonly env?: Record<string, string | undefined>;
  readonly setup?: ExecutionSetupSourceGenerationRow | null;
}): readonly string[] {
  if (input?.setup !== undefined) {
    return formatCursorExecutionAvailabilityDiagnosticLines({
      setup: input.setup,
    });
  }
  return formatCursorExecutionAvailabilityDiagnosticLines({ setup: null });
}
