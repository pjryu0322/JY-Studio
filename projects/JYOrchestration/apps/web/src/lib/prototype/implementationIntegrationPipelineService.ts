import { selectCompletedCodeTasksForIntegration } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import {
  ensureGithubIntegrationBranch,
  isValidProjectIntegrationBranchName,
} from "@/lib/prototype/githubIntegrationBranchService";
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
import {
  asReadonlyArray,
  normalizeCodeTaskIntegrationPlan,
  normalizePartialIntegrationPlanArrays,
} from "@/lib/prototype/implementationIntegrationPlanNormalize";
import {
  assertIntegrationMergeTargets,
  validateCodeTaskIntegrationPlanInvariant,
} from "@/lib/prototype/implementationIntegrationPlanValidation";
import {
  resolveEffectiveIntegrationSourceBranch,
  resolveLatestVerifiedWorkBranchFromIncluded,
} from "@/lib/prototype/integrationEffectiveSourceBranch";
import {
  IntegrationPipelineDomainError,
  buildIntegrationPipelineRuntimeErrorLogFields,
  toUserSafeIntegrationErrorMessage,
  INTEGRATION_BRANCH_REUSE_USER_MESSAGE,
} from "@/lib/prototype/implementationIntegrationErrors";
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
  readonly storedIntegrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly sourceBranch?: string | null;
  readonly targetBranch?: string | null;
  readonly integrationBranch?: string | null;
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

  let lastPlan: CodeTaskIntegrationPlanV1 | null = null;
  let chainHeadForLog: string | null = null;
  let effectiveSourceBranchForLog: string | null = null;
  let integrationBranchReused = false;

  const SOURCE_RESOLUTION_USER_MESSAGE =
    "최종 통합 기준 branch를 결정하지 못했습니다.\n다시 시도해 주세요.";

  const failPipeline = (inputFail: {
    readonly plan: CodeTaskIntegrationPlanV1;
    readonly message: string;
    readonly failureMessage?: string;
  }): RunIntegrationBranchPipelineResult => {
    const plan = patchCodeTaskIntegrationPlan(inputFail.plan, {
      status: "failed",
      ...(inputFail.failureMessage ? { failureMessage: inputFail.failureMessage } : {}),
    });
    return { ok: false, plan, timeline, message: inputFail.message };
  };

  try {
    if (input.storedIntegrationPlan) {
      const { plan: normalizedStored, audit } = normalizePartialIntegrationPlanArrays(
        input.storedIntegrationPlan,
      );
      if (
        !audit.includedWasArray ||
        !audit.excludedWasArray ||
        !audit.mergeResultsWasArray
      ) {
        pushTimeline("implementation_plan_arrays_normalized", {
          ...audit,
        });
      }
      const invariant = validateCodeTaskIntegrationPlanInvariant(normalizedStored);
      lastPlan = invariant.plan;
    }

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
      lastPlan = plan;
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
  if (precheck.status === "info" && precheck.cumulativeOverlap) {
    pushTimeline("implementation_conflict_precheck_cumulative_overlap_detected", {
      overlapCount: precheck.overlapFiles.length,
      severity: "info",
      message: precheck.message,
      topology: precheck.topology?.kind,
    });
  }
  if (precheck.status === "warning") {
    pushTimeline("implementation_conflict_precheck_warning", {
      overlapCount: precheck.overlapFiles.length,
      message: precheck.message,
    });
  }

    const topology = precheck.topology;
    const chainHead =
      topology?.kind === "linear_chain" ? topology.chainHead : null;
    chainHeadForLog = chainHead;

    const includedWorkBranches = targets.included
      .map((row) => String(row.workBranch ?? "").trim())
      .filter(Boolean);
    const latestVerifiedWorkBranch = resolveLatestVerifiedWorkBranchFromIncluded({
      included: targets.included,
      codeTaskPlan: input.codeTaskPlan,
    });

    pushTimeline("implementation_integration_source_resolution_started", {
      contextSourceBranch: input.sourceBranch ?? null,
      contextTargetBranch: input.targetBranch ?? null,
      contextIntegrationBranch: input.integrationBranch ?? null,
      topologyChainHead: chainHead,
      includedWorkBranches: includedWorkBranches.join(","),
    });

    const effectiveSource = resolveEffectiveIntegrationSourceBranch({
      contextSourceBranch: input.sourceBranch ?? null,
      contextTargetBranch: input.targetBranch ?? null,
      contextIntegrationBranch: input.integrationBranch ?? null,
      topologyChainHead: chainHead,
      includedWorkBranches,
      latestVerifiedWorkBranch,
    });
    effectiveSourceBranchForLog = effectiveSource.sourceBranch;

    if (!effectiveSource.ok || !effectiveSource.sourceBranch) {
      pushTimeline("implementation_integration_source_resolution_failed", {
        reason: effectiveSource.reason,
        contextSourceBranch: effectiveSource.diagnostic.contextSourceBranch,
        contextTargetBranch: effectiveSource.diagnostic.contextTargetBranch,
        contextIntegrationBranch: effectiveSource.diagnostic.contextIntegrationBranch,
        topologyChainHead: effectiveSource.diagnostic.topologyChainHead,
        includedWorkBranches: effectiveSource.diagnostic.includedWorkBranches.join(","),
      });
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
      lastPlan = draft;
      return failPipeline({
        plan: draft,
        message: SOURCE_RESOLUTION_USER_MESSAGE,
        failureMessage: SOURCE_RESOLUTION_USER_MESSAGE,
      });
    }

    pushTimeline("implementation_integration_source_resolution_completed", {
      reason: effectiveSource.reason,
      contextSourceBranch: effectiveSource.diagnostic.contextSourceBranch,
      topologyChainHead: effectiveSource.diagnostic.topologyChainHead,
      effectiveSourceBranch: effectiveSource.sourceBranch,
      includedWorkBranches: effectiveSource.diagnostic.includedWorkBranches.join(","),
    });
    pushTimeline("implementation_integration_source_resolved", {
      topology: topology?.kind ?? "unknown",
      sourceBranch: effectiveSource.sourceBranch,
      baseBranch: input.baseBranch,
      reason: effectiveSource.reason,
    });

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
    const resumeIntegrationBranch = lastPlan?.integrationBranch?.trim();
    if (
      resumeIntegrationBranch &&
      isValidProjectIntegrationBranchName(resumeIntegrationBranch, input.projectId)
    ) {
      plan = patchCodeTaskIntegrationPlan(plan, {
        integrationBranch: resumeIntegrationBranch,
      });
    }
    lastPlan = plan;

  plan = patchCodeTaskIntegrationPlan(plan, { status: "branch_creating" });
  pushTimeline("implementation_integration_branch_create_started", {
    baseBranch: plan.baseBranch,
    integrationBranch: plan.integrationBranch,
  });

  const branchEnsure = await ensureGithubIntegrationBranch({
    repoUrl: input.repoUrl,
    baseBranch: plan.baseBranch,
    projectId: input.projectId,
    githubToken: input.githubToken,
    integrationBranch: plan.integrationBranch,
    allowExisting: true,
  });

  if (!branchEnsure.ok || branchEnsure.status === "failed") {
    if (branchEnsure.rawError) {
      pushTimeline("implementation_integration_branch_create_failed", {
        integrationBranch: plan.integrationBranch,
        baseBranch: plan.baseBranch,
        sourceBranch: effectiveSource.sourceBranch ?? undefined,
        rawError: branchEnsure.rawError,
      });
    }
    plan = patchCodeTaskIntegrationPlan(plan, {
      status: "failed",
      failureMessage: branchEnsure.message,
    });
    return { ok: false, plan, timeline, message: branchEnsure.message };
  }

  if (branchEnsure.status === "already_exists") {
    integrationBranchReused = true;
    pushTimeline("implementation_integration_branch_already_exists", {
      integrationBranch: branchEnsure.integrationBranch,
      baseBranch: plan.baseBranch,
      sourceBranch: effectiveSource.sourceBranch ?? undefined,
      reason: "reference_already_exists",
      rawStatus: branchEnsure.rawError ? 422 : undefined,
    });
    pushTimeline("implementation_integration_branch_reused", {
      integrationBranch: branchEnsure.integrationBranch,
      baseBranch: plan.baseBranch,
      sourceBranch: effectiveSource.sourceBranch ?? undefined,
    });
  } else {
    pushTimeline("implementation_integration_branch_created", {
      targetRepository: plan.targetRepository,
      baseBranch: plan.baseBranch,
      integrationBranch: branchEnsure.integrationBranch,
      baseCommitSha: branchEnsure.baseCommitSha,
    });
  }

  plan = patchCodeTaskIntegrationPlan(plan, {
    integrationBranch: branchEnsure.integrationBranch,
    baseCommitSha: branchEnsure.baseCommitSha ?? plan.baseCommitSha ?? null,
    status: "integrating",
  });

  const mergeResults: CodeTaskIntegrationMergeResultV1[] = [];

  plan = normalizeCodeTaskIntegrationPlan(plan);
  lastPlan = plan;
  const included = asReadonlyArray(plan.included);
  const effectiveSourceBranch = effectiveSource.sourceBranch!;
  const mergeItems =
    included.length > 1
      ? included.filter((item) => item.workBranch === effectiveSourceBranch).slice(-1)
      : included;
  assertIntegrationMergeTargets({
    plan,
    effectiveSourceBranch,
    mergeItems,
    diagnostic: {
      contextSourceBranch: input.sourceBranch ?? null,
      contextTargetBranch: input.targetBranch ?? null,
      contextIntegrationBranch: input.integrationBranch ?? null,
      topologyChainHead: chainHead,
      includedWorkBranches,
      effectiveSourceBranch,
      reason: effectiveSource.reason,
    },
  });

  for (const item of mergeItems) {
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

    if (mergeResult.status === "merged" || mergeResult.status === "already_integrated") {
      pushTimeline(
        mergeResult.status === "already_integrated"
          ? "implementation_codetask_branch_already_integrated"
          : "implementation_codetask_branch_merged",
        {
          codeTaskId: item.codeTaskId,
          workBranch: item.workBranch,
          mergeCommitSha: mergeResult.mergeCommitSha,
        },
      );
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
    message: integrationBranchReused
      ? INTEGRATION_BRANCH_REUSE_USER_MESSAGE
      : "integration branch 통합 완료",
    createPr: Boolean(plan.pullRequestUrl),
  };
  } catch (error) {
    if (error instanceof IntegrationPipelineDomainError) {
      const safe = toUserSafeIntegrationErrorMessage(error);
      const basePlan =
        lastPlan ??
        buildCodeTaskIntegrationPlanDraft({
          projectId: input.projectId,
          targetRepository: input.repoUrl,
          baseBranch: input.baseBranch,
          included: [],
          excluded: [],
          codeTaskPlan: input.codeTaskPlan,
          selectedCodeTaskIds: input.selectedCodeTaskIds,
          nowIso,
        });
      return failPipeline({ plan: basePlan, message: safe, failureMessage: safe });
    }

    const logFields = buildIntegrationPipelineRuntimeErrorLogFields(error);
    pushTimeline("integration_pipeline_runtime_error", {
      ...logFields,
      stage: "implementation",
      pipelineStep: "runIntegrationBranchPipeline",
      includedCount: lastPlan ? asReadonlyArray(lastPlan.included).length : null,
      excludedCount: lastPlan ? asReadonlyArray(lastPlan.excluded).length : null,
      chainHead: chainHeadForLog,
      effectiveSourceBranch: effectiveSourceBranchForLog,
      integrationStatus: lastPlan?.status ?? null,
    });

    const basePlan =
      lastPlan ??
      buildCodeTaskIntegrationPlanDraft({
        projectId: input.projectId,
        targetRepository: input.repoUrl,
        baseBranch: input.baseBranch,
        included: [],
        excluded: [],
        codeTaskPlan: input.codeTaskPlan,
        selectedCodeTaskIds: input.selectedCodeTaskIds,
        nowIso,
      });
    return failPipeline({
      plan: basePlan,
      message: logFields.safeMessage,
      failureMessage: logFields.safeMessage,
    });
  }
}
