import { resolveCursorBridgeCloneRoot } from "@/lib/prototype/cursorBridgeRuntime";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";

export type GitRepoWorkspaceRootSource = "execution_setup" | "env_fallback" | "git_repo_auto";

const DEFAULT_PLATFORM_GIT_WORKSPACE_CLONE_ROOT = ".artifacts/git-workspaces";

export function resolveDefaultGitWorkspaceCloneRoot(
  env?: Record<string, string | undefined>,
): string {
  const fromEnv = resolveCursorBridgeCloneRoot(env ?? {});
  if (fromEnv) return fromEnv;
  return DEFAULT_PLATFORM_GIT_WORKSPACE_CLONE_ROOT;
}

/** Derives a stable workdir path under cloneRoot for the configured GitHub repository. */
export function formatGitRepoAutoWorkspaceRoot(
  cloneRoot: string,
  targetRepository: Pick<ProjectTargetRepository, "owner" | "repo">,
): string {
  const root = String(cloneRoot ?? "").trim().replace(/[\\/]+$/, "");
  return `${root}/${targetRepository.owner}-${targetRepository.repo}`;
}

export function resolveSourceGenerationWorkspaceRoot(input: {
  readonly workspacePath?: string | null;
  readonly targetRepository?: ProjectTargetRepository | null;
  readonly env?: Record<string, string | undefined>;
}):
  | Readonly<{ readonly workspaceRoot: string; readonly source: GitRepoWorkspaceRootSource }>
  | null {
  const fromSetup = String(input.workspacePath ?? "").trim();
  if (fromSetup) {
    return { workspaceRoot: fromSetup, source: "execution_setup" };
  }

  if (input.targetRepository) {
    const cloneRoot = resolveDefaultGitWorkspaceCloneRoot(input.env);
    return {
      workspaceRoot: formatGitRepoAutoWorkspaceRoot(cloneRoot, input.targetRepository),
      source: "git_repo_auto",
    };
  }

  const fromEnv = resolveCursorBridgeCloneRoot(input.env ?? {});
  if (fromEnv) {
    return { workspaceRoot: fromEnv, source: "env_fallback" };
  }

  return null;
}

export function formatGitRepoWorkspaceSourceLabel(
  source: GitRepoWorkspaceRootSource | undefined,
): string {
  switch (source) {
    case "execution_setup":
      return "환경설정 경로";
    case "git_repo_auto":
      return "Git 저장소 기준 자동";
    case "env_fallback":
      return "서버 env fallback";
    default:
      return "미설정";
  }
}
