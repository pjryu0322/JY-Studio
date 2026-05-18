/**
 * Stage2 ENV_TEST_STAGE2 orchestration entry surface (reflection → PR → finalize chain).
 * Stage1 must not import this file.
 */
import type { ExecuteCursorRelayParams } from "@/lib/execution/cursorExecutionAdapter";
import { launchCursorAgent } from "@/lib/execution/cursorExecutionAdapter";
import { verifyBaseBranchBeforeCursorExecution } from "@/lib/execution/verifyBaseBranchBeforeCursor";
import type { LoopStepRecord, RunExecutionLoopResult } from "@/lib/executionLoop/runLoopTypes";
import { runEnvTestAfterGithubPushConfirmed } from "@/lib/executionLoop/stage2/stage2PrFlow";
import { waitForStage2BranchExists, waitForStage2BranchReflected } from "@/lib/executionLoop/stage2/stage2GithubMonitor";

export { runEnvTestAfterGithubPushConfirmed } from "./stage2PrFlow";
export {
  runEnvTestReflectionConfirmedPipeline,
  runEnvTestReflectionNotConfirmedGithubBypass,
  type EnvTestReflectionNotConfirmedBypassResult,
} from "./stage2BranchReflection";

/**
 * REAL Stage2 orchestrator:
 * - launch Cursor agent (do not wait for terminal)
 * - GitHub branch exists/reflected is the source of truth
 * - proceed immediately to PR creation via platform flow
 */
export async function runStage2EnvTestPipeline(input: {
  executeParams: ExecuteCursorRelayParams;
  ctx: {
    projectId: string;
    taskId: string;
    actorUserId: string;
    execRunId: string;
    repoUrl: string;
    baseBranch: string;
    headBranch: string;
    githubAccessToken?: string | null;
    execRunCreatedAt: Date;
    steps: LoopStepRecord[];
    singleTaskId?: string;
    effectiveAutoAdvance: boolean;
  };
}): Promise<
  | { kind: "return"; result: RunExecutionLoopResult }
  | { kind: "continue_loop" }
  | { kind: "pr_failed"; message: string }
  | { kind: "cursor_launch_failed"; message: string }
  | { kind: "branch_timeout"; message: string }
> {
  const { executeParams, ctx } = input;

  const preBranch = await verifyBaseBranchBeforeCursorExecution({
    gitRepoUrl: executeParams.executionSetup.gitRepoUrl,
    baseBranch: executeParams.executionSetup.baseBranch,
    githubAccessToken: executeParams.githubAccessToken ?? null,
    projectId: ctx.projectId,
  });
  if (!preBranch.ok) {
    return { kind: "cursor_launch_failed", message: preBranch.message };
  }

  const launch = await launchCursorAgent(executeParams);
  if (!launch.ok) {
    return { kind: "cursor_launch_failed", message: launch.error };
  }

  // GitHub source of truth begins here: as soon as branch exists → compare polling.
  const branchExists = await waitForStage2BranchExists({
    repoUrl: ctx.repoUrl,
    headBranch: ctx.headBranch,
    githubAccessToken: ctx.githubAccessToken ?? null,
    projectId: ctx.projectId,
    timeoutMs: 60_000,
    pollIntervalMs: 1200,
  });
  if (!branchExists.ok) {
    return { kind: "branch_timeout", message: branchExists.message };
  }

  const reflected = await waitForStage2BranchReflected({
    repoUrl: ctx.repoUrl,
    baseBranch: ctx.baseBranch,
    headBranch: ctx.headBranch,
    githubAccessToken: ctx.githubAccessToken ?? null,
    projectId: ctx.projectId,
    timeoutMs: 60_000,
    pollIntervalMs: 1200,
  });
  if (!reflected.ok) {
    return { kind: "branch_timeout", message: reflected.message };
  }

  // No artificial delay after reflection. Proceed immediately to Stage2 PR flow.
  return await runEnvTestAfterGithubPushConfirmed({
    projectId: ctx.projectId,
    taskId: ctx.taskId,
    taskKind: executeParams.taskKind ?? null,
    execRunId: ctx.execRunId,
    actorUserId: ctx.actorUserId,
    branchName: ctx.headBranch,
    repoUrl: ctx.repoUrl,
    baseBranch: ctx.baseBranch,
    githubAccessToken: ctx.githubAccessToken ?? null,
    compareData: {
      headSha: reflected.headSha ?? branchExists.headSha ?? null,
      changedFiles: reflected.changedFiles,
      diffSummary: reflected.diffSummary,
      compareOkAtMs: reflected.compareOkAtMs,
    },
    steps: ctx.steps,
    singleTaskId: ctx.singleTaskId,
    effectiveAutoAdvance: ctx.effectiveAutoAdvance,
    cursorRunId: launch.agentId,
    cursorSummary: "(Stage2) GitHub source of truth — Cursor terminal not awaited",
    via: "stage2_github_monitor",
    pushDetectedSource: "stage2_github_monitor_compare",
    executionRunCreatedAt: ctx.execRunCreatedAt,
    branchDetectElapsedMs: reflected.elapsedMs,
  });
}
