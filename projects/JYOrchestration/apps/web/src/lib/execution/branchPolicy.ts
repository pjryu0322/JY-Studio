import { ENV_TEST_STAGE2_TASK_KIND, ENV_TEST_TASK_KIND } from "@/lib/execution/envTestTaskKind";
import {
  isExecutionAllowManualStayOnBase,
  shortIdFromUuid,
  toSafeBranchSlug,
} from "@/lib/execution/branchSlug";
import { repoSlugFromGitRepoName } from "@/lib/git-provisioning/repoNamePolicy";

export type BranchPlan = {
  branchName: string;
  /** true면 새 브랜치를 만들지 않고 base만 체크아웃 */
  manualStayOnBase: boolean;
};

/** ENV_TEST Hello World 연결 테스트 브랜치 접두사 (`<prefix><8hex>`) */
export const ENV_TEST_HELLO_WORLD_BRANCH_PREFIX = "envcheck/t-hello-world-" as const;

/** GitHub 웹훅·루프에서 Hello World ENV_TEST 브랜치만 매칭 */
export function isEnvTestHelloWorldBranchName(branchName: string): boolean {
  const b = String(branchName ?? "").trim();
  return (
    b.startsWith(ENV_TEST_HELLO_WORLD_BRANCH_PREFIX) &&
    /^envcheck\/t-hello-world-[0-9a-f]{8}$/i.test(b)
  );
}

function projectSlugSegment(
  projectId: string,
  repositoryName?: string | null,
  projectName?: string | null
): string {
  const shortProjectId = shortIdFromUuid(projectId, 8);
  const fallback = `p-${shortProjectId}`;
  const repoSlug = repoSlugFromGitRepoName(repositoryName);
  if (repoSlug) {
    return toSafeBranchSlug(repoSlug, fallback, 28);
  }
  return toSafeBranchSlug(projectName ?? "", fallback, 28);
}

/**
 * execution setup 전략에 따른 작업 브랜치 이름.
 * - ENV_TEST / ENV_TEST_STAGE2 → Hello World 전용 (unchanged)
 * - feature-per-workflow → {prefix}/{projectSlug}/w-{shortProjectId}
 * - feature-per-task (and per_task alias) → {prefix}/{projectSlug}/t-{shortId}-{titleSlug}
 * - manual → working branch under prefix/manual (not baseBranch unless EXECUTION_ALLOW_MANUAL_STAY_ON_BASE=1)
 */
export function computeExecutionBranchPlan(params: {
  branchStrategy: string;
  branchPrefix: string | null;
  projectId: string;
  /** @deprecated Use repositoryName (ExecutionSetup.gitRepoName) when available. */
  projectName?: string | null;
  /** ExecutionSetup.gitRepoName or bare repo — preferred for branch slug. */
  repositoryName?: string | null;
  taskId: string;
  taskTitle: string;
  baseBranch: string;
  taskKind?: string | null;
}): BranchPlan {
  const tk = String(params.taskKind ?? "").trim();
  if (tk === ENV_TEST_TASK_KIND || tk === ENV_TEST_STAGE2_TASK_KIND) {
    const shortId = params.taskId.replace(/-/g, "").slice(0, 8) || "test";
    return { branchName: `${ENV_TEST_HELLO_WORLD_BRANCH_PREFIX}${shortId}`, manualStayOnBase: false };
  }

  const base = String(params.baseBranch ?? "").trim() || "main";
  const prefix = String(params.branchPrefix ?? "orch")
    .trim()
    .replace(/[^\w/-]/g, "")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 40) || "orch";

  const projectSlug = projectSlugSegment(
    params.projectId,
    params.repositoryName,
    params.projectName
  );
  const shortProjectId = shortIdFromUuid(params.projectId, 8);
  const shortTaskId = params.taskId.replace(/-/g, "").slice(0, 10);
  const titleSlug = toSafeBranchSlug(params.taskTitle, "task", 24);

  const strategy = String(params.branchStrategy ?? "").trim();

  if (strategy === "manual") {
    if (isExecutionAllowManualStayOnBase()) {
      return { branchName: base, manualStayOnBase: true };
    }
    return {
      branchName: `${prefix}/manual/t-${shortTaskId}-${titleSlug}`,
      manualStayOnBase: false,
    };
  }

  if (strategy === "feature-per-workflow") {
    return {
      branchName: `${prefix}/${projectSlug}/w-${shortProjectId}`,
      manualStayOnBase: false,
    };
  }

  // feature-per-task, per_task, and default
  return {
    branchName: `${prefix}/${projectSlug}/t-${shortTaskId}-${titleSlug}`,
    manualStayOnBase: false,
  };
}
