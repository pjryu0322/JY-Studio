import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { PlatformScmExecutionV1 } from "@/lib/prototype/platformScmExecution";

export type PlatformScmWipContext = Readonly<{
  readonly projectId: string;
  readonly taskId: string;
  readonly repoFullName?: string;
  readonly branchName?: string;
  readonly commitSha?: string;
  readonly workspacePath?: string;
  readonly scm?: PlatformScmExecutionV1;
}>;

export function resolvePlatformScmWipContext(wip: CodeAgentWipExecutionV1): PlatformScmWipContext {
  const scm = wip.platformScmExecutionV1;
  const lastCommit = wip.commits[wip.commits.length - 1];
  return {
    projectId: wip.projectId,
    taskId: wip.selectedTaskId ?? scm?.selectedTaskId ?? "unknown",
    repoFullName: wip.targetRepoFullName ?? wip.targetRepository ?? scm?.targetRepository,
    branchName: scm?.sourceBranchName ?? lastCommit?.branchName ?? wip.branchName,
    commitSha: scm?.sourceCommitSha ?? lastCommit?.sha ?? wip.commitSha,
    workspacePath: wip.workspacePath,
    ...(scm ? { scm } : {}),
  };
}
