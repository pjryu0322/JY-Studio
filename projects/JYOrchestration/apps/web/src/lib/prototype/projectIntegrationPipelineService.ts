import { runAppPreviewTargetIntegrationStep } from "@/lib/prototype/implementationAppPreviewTargetStepService";
import { runBuildIntegrationStep } from "@/lib/prototype/implementationBuildStepService";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { isIntegratedAppRenderTarget } from "@/lib/prototype/implementationAppPreviewTarget";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { runLegacyIntegrationBranchPipelineAsFinalWiringAdapter } from "@/lib/prototype/implementationIntegrationLegacyPipelineAdapter";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { ensurePersistedImplementationIntegrationSteps } from "@/lib/prototype/implementationIntegrationStepBootstrap";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import {
  findIntegrationStep,
  isIntegrationStepCompleted,
  mapIntegrationStepByKind,
} from "@/lib/prototype/implementationIntegrationStepMutations";
import {
  loadImplementationIntegrationStepsFromState,
  saveImplementationIntegrationStepsToState,
} from "@/lib/prototype/implementationIntegrationStepStore";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import type { ProjectIntegrationPipelineContextV1 } from "@/lib/prototype/integrationPipelineContext";
import { projectIntegrationPipelineContextLogFields } from "@/lib/prototype/integrationPipelineContext";
import type { ProjectIntegrationPipelineEligibilityV1 } from "@/lib/prototype/projectIntegrationPipelineEligibility";
import { mapEligibilityReasonToPipelineStatus } from "@/lib/prototype/projectIntegrationPipelineEligibility";

export type ProjectIntegrationPipelineResultV1 = Readonly<{
  readonly ok: boolean;
  readonly status:
    | "integrated_app_preview_ready"
    | "build_pending"
    | "build_failed"
    | "app_preview_target_failed"
    | "final_wiring_failed"
    | "integration_branch_failed"
    | "codetasks_incomplete"
    | "step_missing"
    | "pipeline_blocked";
  readonly integrationBranch?: string | null;
  readonly previewReady: boolean;
  readonly previewUrl?: string | null;
  readonly nextRequiredStep?: "build" | "app_preview_target" | null;
  readonly userSafeMessage?: string | null;
  readonly plan?: CodeTaskIntegrationPlanV1;
  readonly previewRuntimePatch?: Partial<RequirementsStateJson>;
  readonly orchestrationPatch?: Partial<RequirementsStateJson>;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly eligibilityReasonCode?: ProjectIntegrationPipelineEligibilityV1["reasonCode"];
}>;

function persistIntegrationStepsPatch(input: {
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly reason: string;
  readonly nowIso: string;
  readonly extra?: Partial<RequirementsStateJson>;
}): Partial<RequirementsStateJson> {
  return mergeOrchestrationPersistPatches(
    input.orchestrationPatch,
    saveImplementationIntegrationStepsToState({
      projectId: input.projectId,
      steps: input.steps,
      reason: input.reason,
      nowIso: input.nowIso,
    }),
    input.extra ?? {},
  );
}

function stampIntegrationStepsWithPipelineContext(
  steps: readonly ImplementationIntegrationStepV1[],
  context: ProjectIntegrationPipelineContextV1,
): readonly ImplementationIntegrationStepV1[] {
  return steps.map((s) => ({
    ...s,
    stage: context.stage,
    mode: context.mode,
    trigger: context.trigger,
    sourceBranch: context.sourceBranch,
    targetBranch: context.targetBranch,
    reviewRequestId: context.reviewRequestId ?? s.reviewRequestId ?? null,
    changeRequestId: context.changeRequestId ?? s.changeRequestId ?? null,
  }));
}

function applyWiringAndBranchFromLegacyPipeline(input: {
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly ok: boolean;
  readonly integrationBranch: string | null;
  readonly plan: CodeTaskIntegrationPlanV1;
  readonly message: string;
  readonly nowIso: string;
}): Readonly<{
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly failed: boolean;
  readonly userSafeMessage?: string;
}> {
  if (!input.ok) {
    return {
      failed: true,
      userSafeMessage: input.message,
      steps: input.steps.map((s) => {
        if (s.kind !== "final_wiring" && s.kind !== "integration_branch") return s;
        return {
          ...s,
          status: "failed" as const,
          failedAt: input.nowIso,
          errorCode: s.kind === "final_wiring" ? "final_wiring_failed" : "integration_branch_failed",
          errorMessage: input.message,
        };
      }),
    };
  }
  return {
    failed: false,
    steps: input.steps.map((s) => {
      if (s.kind === "final_wiring") {
        return {
          ...s,
          status: "completed" as const,
          completedAt: input.nowIso,
          commitSha: input.plan.baseCommitSha ?? s.commitSha ?? null,
        };
      }
      if (s.kind === "integration_branch" && input.integrationBranch) {
        return {
          ...s,
          status: "completed" as const,
          completedAt: input.nowIso,
          workBranch: input.integrationBranch,
        };
      }
      return s;
    }),
  };
}

function pushPipelineTimeline(
  timeline: RequirementsPromptTimelineEntry[],
  input: {
    readonly action: string;
    readonly context: ProjectIntegrationPipelineContextV1;
    readonly nowIso: string;
    readonly extra?: Readonly<Record<string, string | number | boolean | undefined | null>>;
  },
): void {
  timeline.push(
    buildImplementationExecutionLogTimelineEntry({
      action: input.action,
      orchestrationTraceGroup: "project_integration_pipeline",
      fields: {
        ...projectIntegrationPipelineContextLogFields(input.context),
        ...input.extra,
      },
      nowIso: input.nowIso,
    }),
  );
}

export async function runProjectIntegrationPipeline(input: {
  readonly context: ProjectIntegrationPipelineContextV1;
  readonly eligibility: ProjectIntegrationPipelineEligibilityV1;

  readonly repoUrl: string;
  readonly githubToken: string;

  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly codeTaskRuns: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;

  readonly storedIntegrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly integrationSteps?: readonly ImplementationIntegrationStepV1[] | null;
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;

  readonly requirementsState?: RequirementsStateJson | null;
}): Promise<ProjectIntegrationPipelineResultV1> {
  const context = input.context;
  const nowIso = context.nowIso ?? new Date().toISOString();
  const pid = context.projectId.trim();
  const timeline: RequirementsPromptTimelineEntry[] = [];

  pushPipelineTimeline(timeline, {
    action: "project_integration_pipeline_requested",
    context,
    nowIso,
  });

  if (!input.eligibility.canRun) {
    pushPipelineTimeline(timeline, {
      action: "project_integration_pipeline_blocked",
      context,
      nowIso,
      extra: { reasonCode: input.eligibility.reasonCode },
    });
    const status = mapEligibilityReasonToPipelineStatus(input.eligibility.reasonCode);
    return {
      ok: false,
      status: status === "step_missing" ? "step_missing" : "codetasks_incomplete",
      previewReady: false,
      userSafeMessage: input.eligibility.userMessage,
      timelineEntries: timeline,
      eligibilityReasonCode: input.eligibility.reasonCode,
    };
  }

  let state =
    input.requirementsState ??
    parseRequirementsStateJson(
      (
        await prisma.project.findUnique({
          where: { id: pid },
          select: { requirementsStateJson: true },
        })
      )?.requirementsStateJson,
    ) ??
    {};

  const ensured = ensurePersistedImplementationIntegrationSteps({
    projectId: pid,
    requirementsState: state,
    codeTaskPlan: input.codeTaskPlan,
    nowIso,
  });
  state = mergeRequirementsStateJson(state, ensured.orchestrationPatch);
  timeline.push(...ensured.timeline);

  let steps = stampIntegrationStepsWithPipelineContext(
    [...(input.integrationSteps ?? loadImplementationIntegrationStepsFromState(state))],
    context,
  );
  if (!findIntegrationStep(steps, "final_wiring")) {
    pushPipelineTimeline(timeline, {
      action: "project_integration_pipeline_blocked",
      context,
      nowIso,
      extra: { reasonCode: "integration_step_missing" },
    });
    return {
      ok: false,
      status: "step_missing",
      previewReady: false,
      userSafeMessage: "최종 연결/통합 Wiring 단계가 구성되지 않았습니다.",
      timelineEntries: timeline,
      eligibilityReasonCode: "integration_step_missing",
    };
  }

  pushPipelineTimeline(timeline, {
    action: "project_integration_pipeline_started",
    context,
    nowIso,
  });

  let plan = input.storedIntegrationPlan ?? state.codeTaskIntegrationPlanV1 ?? null;
  let orchestrationPatch: Partial<RequirementsStateJson> = { ...ensured.orchestrationPatch };
  let previewRuntimePatch: Partial<RequirementsStateJson> | undefined;

  const wiringDone = isIntegrationStepCompleted(steps, "final_wiring");
  const branchDone = isIntegrationStepCompleted(steps, "integration_branch");

  if (!wiringDone || !branchDone) {
    steps = mapIntegrationStepByKind(steps, "final_wiring", (s) =>
      s.status === "completed"
        ? s
        : { ...s, status: "running", startedAt: s.startedAt ?? nowIso },
    );
    steps = mapIntegrationStepByKind(steps, "integration_branch", (s) =>
      s.status === "completed" ? s : { ...s, status: "running", startedAt: s.startedAt ?? nowIso },
    );
    pushPipelineTimeline(timeline, {
      action: "project_integration_pipeline_step_started",
      context,
      nowIso,
      extra: { stepKind: "final_wiring" },
    });
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_integration_final_wiring_started",
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: pid, trigger: context.trigger, ...projectIntegrationPipelineContextLogFields(context) },
        nowIso,
      }),
    );

    const legacy = await runLegacyIntegrationBranchPipelineAsFinalWiringAdapter({
      projectId: pid,
      repoUrl: input.repoUrl,
      baseBranch: context.baseBranch,
      sourceBranch: context.sourceBranch,
      targetBranch: context.targetBranch,
      integrationBranch: context.integrationBranch,
      githubToken: input.githubToken,
      codeTaskPlan: input.codeTaskPlan,
      taskList: input.taskList,
      codeTaskRuns: input.codeTaskRuns,
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      createPullRequest: context.createPullRequest,
      storedIntegrationPlan: input.storedIntegrationPlan ?? plan,
      nowIso,
    });
    timeline.push(...legacy.timeline);
    plan = legacy.plan;

    const applied = applyWiringAndBranchFromLegacyPipeline({
      steps,
      ok: legacy.ok,
      integrationBranch: legacy.integrationBranch,
      plan: legacy.plan,
      message: legacy.message,
      nowIso,
    });
    steps = stampIntegrationStepsWithPipelineContext([...applied.steps], context);

    orchestrationPatch = persistIntegrationStepsPatch({
      orchestrationPatch,
      projectId: pid,
      steps,
      reason: legacy.ok
        ? "implementation_integration_final_wiring_completed"
        : "implementation_integration_final_wiring_failed",
      nowIso,
      extra: { codeTaskIntegrationPlanV1: legacy.plan },
    });

    if (applied.failed) {
      pushPipelineTimeline(timeline, {
        action: "project_integration_pipeline_step_failed",
        context,
        nowIso,
        extra: { stepKind: "final_wiring" },
      });
      timeline.push(
        buildImplementationExecutionLogTimelineEntry({
          action: "implementation_integration_final_wiring_failed",
          orchestrationTraceGroup: "implementation_integration",
          fields: { projectId: pid, reason: legacy.message.slice(0, 200) },
          nowIso,
        }),
      );
      return {
        ok: false,
        status: legacy.ok ? "integration_branch_failed" : "final_wiring_failed",
        previewReady: false,
        userSafeMessage: applied.userSafeMessage ?? legacy.message,
        plan: legacy.plan,
        orchestrationPatch,
        timelineEntries: timeline,
      };
    }

    pushPipelineTimeline(timeline, {
      action: "project_integration_pipeline_step_completed",
      context,
      nowIso,
      extra: { stepKind: "final_wiring" },
    });
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_integration_final_wiring_completed",
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: pid, integrationBranch: legacy.integrationBranch },
        nowIso,
      }),
    );
  }

  pushPipelineTimeline(timeline, {
    action: "project_integration_pipeline_step_started",
    context,
    nowIso,
    extra: { stepKind: "build" },
  });

  const buildResult = runBuildIntegrationStep({
    projectId: pid,
    steps,
    plan,
    nowIso,
  });
  steps = stampIntegrationStepsWithPipelineContext([...buildResult.steps], context);
  timeline.push(...buildResult.timelineEntries);
  orchestrationPatch = persistIntegrationStepsPatch({
    orchestrationPatch,
    projectId: pid,
    steps,
    reason: buildResult.ok ? "implementation_integration_build_completed" : "implementation_integration_build_failed",
    nowIso,
  });

  if (!buildResult.ok) {
    pushPipelineTimeline(timeline, {
      action: "project_integration_pipeline_step_failed",
      context,
      nowIso,
      extra: { stepKind: "build" },
    });
    return {
      ok: false,
      status: "build_failed",
      previewReady: false,
      nextRequiredStep: "build",
      userSafeMessage: buildResult.userSafeMessage,
      plan: plan ?? undefined,
      orchestrationPatch,
      integrationBranch: plan?.integrationBranch ?? context.integrationBranch ?? null,
      timelineEntries: timeline,
    };
  }

  pushPipelineTimeline(timeline, {
    action: "project_integration_pipeline_step_completed",
    context,
    nowIso,
    extra: { stepKind: "build" },
  });

  pushPipelineTimeline(timeline, {
    action: "project_integration_pipeline_step_started",
    context,
    nowIso,
    extra: { stepKind: "app_preview_target" },
  });

  const previewResult = runAppPreviewTargetIntegrationStep({
    projectId: pid,
    steps,
    plan,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    codeTaskRuns: input.codeTaskRuns,
    nowIso,
  });
  steps = stampIntegrationStepsWithPipelineContext([...previewResult.steps], context);
  timeline.push(...previewResult.timelineEntries);
  previewRuntimePatch = previewResult.previewRuntimePatch;
  orchestrationPatch = persistIntegrationStepsPatch({
    orchestrationPatch,
    projectId: pid,
    steps,
    reason: previewResult.ok
      ? "implementation_integration_app_preview_target_completed"
      : "implementation_integration_app_preview_target_failed",
    nowIso,
    extra: previewResult.previewRuntimePatch ?? {},
  });

  if (!previewResult.ok) {
    pushPipelineTimeline(timeline, {
      action: "project_integration_pipeline_step_failed",
      context,
      nowIso,
      extra: { stepKind: "app_preview_target" },
    });
    return {
      ok: false,
      status: "app_preview_target_failed",
      previewReady: false,
      nextRequiredStep: "app_preview_target",
      userSafeMessage: previewResult.userSafeMessage,
      plan: plan ?? undefined,
      previewRuntimePatch,
      orchestrationPatch,
      integrationBranch: plan?.integrationBranch ?? context.integrationBranch ?? null,
      previewUrl: previewResult.previewUrl ?? null,
      timelineEntries: timeline,
    };
  }

  pushPipelineTimeline(timeline, {
    action: "project_integration_pipeline_step_completed",
    context,
    nowIso,
    extra: { stepKind: "app_preview_target" },
  });

  const runtime = previewResult.previewRuntime ?? null;
  const integratedReady =
    isIntegrationStepCompleted(steps, "final_wiring") &&
    isIntegrationStepCompleted(steps, "integration_branch") &&
    isIntegrationStepCompleted(steps, "build") &&
    isIntegrationStepCompleted(steps, "app_preview_target") &&
    isIntegratedAppRenderTarget({
      runtime,
      integrationPlan: plan,
      projectId: pid,
    });

  pushPipelineTimeline(timeline, {
    action: "project_integration_pipeline_completed",
    context,
    nowIso,
    extra: { previewReady: integratedReady },
  });

  if (integratedReady) {
    return {
      ok: true,
      status: "integrated_app_preview_ready",
      previewReady: true,
      previewUrl: previewResult.previewUrl ?? runtime?.previewUrl ?? null,
      nextRequiredStep: null,
      plan: plan ?? undefined,
      previewRuntimePatch,
      orchestrationPatch,
      integrationBranch: plan?.integrationBranch ?? context.integrationBranch ?? null,
      timelineEntries: timeline,
    };
  }

  return {
    ok: true,
    status: "build_pending",
    previewReady: false,
    nextRequiredStep: "app_preview_target",
    plan: plan ?? undefined,
    previewRuntimePatch,
    orchestrationPatch,
    integrationBranch: plan?.integrationBranch ?? context.integrationBranch ?? null,
    previewUrl: previewResult.previewUrl ?? null,
    userSafeMessage: "통합 단계는 진행됐지만 Integrated App Preview 조건이 아직 충족되지 않았습니다.",
    timelineEntries: timeline,
  };
}
