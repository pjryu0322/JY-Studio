import { selectCompletedCodeTasksForIntegration } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import { createGithubIntegrationBranch } from "@/lib/prototype/githubIntegrationBranchService";
import { mergeWorkBranchIntoIntegrationBranch } from "@/lib/prototype/githubIntegrationMergeService";
import {
  buildCodeTaskIntegrationPlanDraft,
  patchCodeTaskIntegrationPlan,
  type CodeTaskIntegrationMergeResultV1,
  type CodeTaskIntegrationPlanV1,
} from "@/lib/prototype/implementationIntegrationPlan";
import { runIntegrationBranchChecks } from "@/lib/prototype/implementationIntegrationCheckService";
import { canCreateIntegrationPullRequest } from "@/lib/prototype/implementationIntegrationConflict";
import { createIntegrationPullRequest } from "@/lib/prototype/githubIntegrationPullRequestService";
import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { ensureCodeTaskPlanWithFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import { runIntegrationConflictPrecheck } from "@/lib/prototype/integrationConflictPrecheck";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type RunIntegrationBranchPipelineResult = Readonly<{
  readonly ok: boolean;
  readonly plan: CodeTaskIntegrationPlanV1;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
  readonly message: string;
  readonly createPr?: boolean;
}>;

export async function runIntegrationBranchPipeline(input: {
  readonly projectId: string;
  readonly projectName?: string | null;
  readonly repoUrl: string;
  readonly baseBranch: string;
  readonly githubToken: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly codeTaskRuns: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly previewUrl?: string | null;
  readonly createPullRequest?: boolean;
  readonly nowIso?: string;
}): Promise<RunIntegrationBranchPipelineResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const timeline: RequirementsPromptTimelineEntry[] = [];
  const pushTimeline = (
    action: string,
    fields: Record<string, unknown>,
  ) => {
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action,
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: input.projectId, ...fields },
        nowIso,
      }),
    );
  };

  const targets = selectCompletedCodeTasksForIntegration({
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    codeTaskRuns: input.codeTaskRuns,
  });

  if (!targets.canIntegrate) {
    const plan = buildCodeTaskIntegrationPlanDraft({
      projectId: input.projectId,
      targetRepository: input.repoUrl,
      baseBranch: input.baseBranch,
      included: [],
      excluded: targets.excluded,
      codeTaskPlan: input.codeTaskPlan,
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      nowIso,
    });
    return {
      ok: false,
      plan: patchCodeTaskIntegrationPlan(plan, {
        status: "failed",
        failureMessage: "완료된 CodeTask가 없어 integration branch를 만들 수 없습니다.",
      }),
      timeline,
      message: "완료된 CodeTask가 없어 integration branch를 만들 수 없습니다.",
    };
  }

  const runIdByCodeTaskId = new Map<string, string>();
  for (const row of targets.included) {
    const run = findLatestRunForCodeTask(input.codeTaskRuns ?? [], row.codeTaskId);
    if (run?.runId) runIdByCodeTaskId.set(row.codeTaskId, run.runId);
  }

  const codeTaskPlanForPrecheck =
    ensureCodeTaskPlanWithFileBoundaries({
      plan: input.codeTaskPlan,
      taskList: input.taskList,
    }) ?? input.codeTaskPlan;
  const precheck = runIntegrationConflictPrecheck({
    included: targets.included,
    codeTaskPlan: codeTaskPlanForPrecheck,
    codeTaskRuns: input.codeTaskRuns,
    conflictPlan: codeTaskPlanForPrecheck?.codeTaskConflictPlanV1 ?? null,
  });
  if (precheck.status === "blocking") {
    const draft = buildCodeTaskIntegrationPlanDraft({
      projectId: input.projectId,
      targetRepository: input.repoUrl,
      baseBranch: input.baseBranch,
      included: targets.included,
      excluded: targets.excluded,
      codeTaskPlan: input.codeTaskPlan,
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      runIdByCodeTaskId,
      nowIso,
    });
    pushTimeline("implementation_conflict_precheck_blocked", {
      overlapCount: precheck.overlapFiles.length,
      message: precheck.message,
    });
    return {
      ok: false,
      plan: patchCodeTaskIntegrationPlan(draft, {
        status: "failed",
        failureMessage: precheck.message ?? "통합 전 changed files overlap — merge 중단",
      }),
      timeline,
      message: precheck.message ?? "통합 전 changed files overlap으로 merge를 시작하지 않습니다.",
    };
  }
  if (precheck.status === "warning") {
    pushTimeline("implementation_conflict_precheck_warning", {
      overlapCount: precheck.overlapFiles.length,
      message: precheck.message,
    });
  }

  let plan = buildCodeTaskIntegrationPlanDraft({
    projectId: input.projectId,
    targetRepository: input.repoUrl,
    baseBranch: input.baseBranch,
    included: targets.included,
    excluded: targets.excluded,
    codeTaskPlan: input.codeTaskPlan,
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    runIdByCodeTaskId,
    nowIso,
  });

  plan = patchCodeTaskIntegrationPlan(plan, { status: "branch_creating" });
  pushTimeline("implementation_integration_branch_create_started", {
    baseBranch: plan.baseBranch,
    integrationBranch: plan.integrationBranch,
  });

  const branchCreate = await createGithubIntegrationBranch({
    repoUrl: input.repoUrl,
    baseBranch: plan.baseBranch,
    projectId: input.projectId,
    githubToken: input.githubToken,
    integrationBranch: plan.integrationBranch,
  });

  if (!branchCreate.ok) {
    plan = patchCodeTaskIntegrationPlan(plan, {
      status: "failed",
      failureMessage: branchCreate.message,
    });
    return { ok: false, plan, timeline, message: branchCreate.message };
  }

  plan = patchCodeTaskIntegrationPlan(plan, {
    integrationBranch: branchCreate.integrationBranch,
    baseCommitSha: branchCreate.baseCommitSha,
    status: "integrating",
  });
  pushTimeline("implementation_integration_branch_created", {
    targetRepository: plan.targetRepository,
    baseBranch: plan.baseBranch,
    integrationBranch: plan.integrationBranch,
    baseCommitSha: branchCreate.baseCommitSha,
  });

  const mergeResults: CodeTaskIntegrationMergeResultV1[] = [];

  for (const item of plan.included) {
    pushTimeline("implementation_codetask_branch_merge_started", {
      codeTaskId: item.codeTaskId,
      workBranch: item.workBranch,
      integrationBranch: plan.integrationBranch,
    });

    const mergeResult = await mergeWorkBranchIntoIntegrationBranch({
      repoUrl: input.repoUrl,
      integrationBranch: plan.integrationBranch,
      workBranch: item.workBranch,
      codeTaskId: item.codeTaskId,
      commitSha: item.commitSha,
      githubToken: input.githubToken,
    });
    mergeResults.push(mergeResult);

    if (mergeResult.status === "merged") {
      pushTimeline("implementation_codetask_branch_merged", {
        codeTaskId: item.codeTaskId,
        workBranch: item.workBranch,
        mergeCommitSha: mergeResult.mergeCommitSha,
      });
      continue;
    }

    if (mergeResult.status === "conflict") {
      pushTimeline("implementation_codetask_branch_conflict", {
        codeTaskId: item.codeTaskId,
        workBranch: item.workBranch,
        message: mergeResult.message,
      });
      plan = patchCodeTaskIntegrationPlan(plan, {
        status: "conflict",
        mergeResults,
        conflictCodeTaskId: item.codeTaskId,
        failureMessage: mergeResult.message ?? "merge conflict",
      });
      return {
        ok: false,
        plan,
        timeline,
        message: `통합 중 충돌: ${item.workBranch}`,
      };
    }

    pushTimeline("implementation_codetask_branch_merge_failed", {
      codeTaskId: item.codeTaskId,
      workBranch: item.workBranch,
      message: mergeResult.message,
    });
    plan = patchCodeTaskIntegrationPlan(plan, {
      status: "failed",
      mergeResults,
      failureMessage: mergeResult.message ?? "merge failed",
    });
    return { ok: false, plan, timeline, message: mergeResult.message ?? "merge failed" };
  }

  plan = patchCodeTaskIntegrationPlan(plan, { mergeResults, status: "build_checking" });

  const checkResult = await runIntegrationBranchChecks({
    repoUrl: input.repoUrl,
    integrationBranch: plan.integrationBranch,
    githubToken: input.githubToken,
  });
  plan = patchCodeTaskIntegrationPlan(plan, { checkResult });

  if (checkResult.status === "failed") {
    plan = patchCodeTaskIntegrationPlan(plan, {
      status: "failed",
      failureMessage: "integration branch 검증 실패",
    });
    return { ok: false, plan, timeline, message: "integration branch 검증 실패" };
  }

  plan = patchCodeTaskIntegrationPlan(plan, { status: "preview_ready" });

  if (input.createPullRequest !== false && canCreateIntegrationPullRequest(plan)) {
    const pr = await createIntegrationPullRequest({
      plan,
      repoUrl: input.repoUrl,
      githubToken: input.githubToken,
      projectId: input.projectId,
      projectName: input.projectName,
      previewUrl: input.previewUrl,
    });
    if (pr.ok) {
      plan = patchCodeTaskIntegrationPlan(plan, {
        status: "pr_ready",
        pullRequestUrl: pr.prUrl,
        pullRequestNumber: pr.prNumber,
      });
      pushTimeline("implementation_integration_pr_created", {
        pullRequestUrl: pr.prUrl,
        pullRequestNumber: pr.prNumber,
        integrationBranch: plan.integrationBranch,
      });
    }
  }

  return {
    ok: true,
    plan,
    timeline,
    message: "integration branch 통합 완료",
    createPr: Boolean(plan.pullRequestUrl),
  };
}
