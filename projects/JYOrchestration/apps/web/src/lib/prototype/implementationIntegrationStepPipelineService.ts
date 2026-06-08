import { runAppPreviewTargetIntegrationStep } from "@/lib/prototype/implementationAppPreviewTargetStepService";
import { runBuildIntegrationStep } from "@/lib/prototype/implementationBuildStepService";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  areAllSelectedExecutionUnitsVerifiedWithRuns,
} from "@/lib/prototype/implementationExecutionSelectedUnits";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { isIntegratedAppRenderTarget } from "@/lib/prototype/implementationAppPreviewTarget";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
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

export type RunImplementationIntegrationStepPipelineResultV1 = Readonly<{
  readonly ok: boolean;
  readonly status:
    | "integrated_app_preview_ready"
    | "build_pending"
    | "build_failed"
    | "app_preview_target_failed"
    | "final_wiring_failed"
    | "integration_branch_failed"
    | "codetasks_incomplete"
    | "step_missing";
  readonly integrationBranch?: string | null;
  readonly previewReady: boolean;
  readonly previewUrl?: string | null;
  readonly nextRequiredStep?: "build" | "app_preview_target" | null;
  readonly userSafeMessage?: string | null;
  readonly plan?: CodeTaskIntegrationPlanV1;
  readonly previewRuntimePatch?: Partial<RequirementsStateJson>;
  readonly orchestrationPatch?: Partial<RequirementsStateJson>;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
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

export async function runImplementationIntegrationStepPipeline(input: {
  readonly projectId: string;
  readonly trigger: "manual_integration_button" | "auto_after_codetasks_verified";
  readonly repoUrl: string;
  readonly baseBranch: string;
  readonly githubToken: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly codeTaskRuns: readonly CodeTaskExecutionRunV1[] | null;
  readonly selectedCodeTaskIds?: readonly string[] | null;
  readonly storedIntegrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly createPullRequest?: boolean;
  readonly nowIso?: string;
}): Promise<RunImplementationIntegrationStepPipelineResultV1> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const timeline: RequirementsPromptTimelineEntry[] = [];

  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  let state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  const ensured = ensurePersistedImplementationIntegrationSteps({
    projectId: pid,
    requirementsState: state,
    codeTaskPlan: input.codeTaskPlan,
    nowIso,
  });
  state = mergeRequirementsStateJson(state, ensured.orchestrationPatch);
  timeline.push(...ensured.timeline);

  const summary = buildImplementationExecutionSummaryCounts({
    projectId: pid,
    requirementsState: state,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    runs: input.codeTaskRuns,
  });
  if (
    !areAllSelectedExecutionUnitsVerifiedWithRuns({
      units: summary.executionUnits,
      selectedUnitIds: summary.selectedExecutionUnitIds,
      runs: input.codeTaskRuns,
    })
  ) {
    return {
      ok: false,
      status: "codetasks_incomplete",
      previewReady: false,
      userSafeMessage: "선택한 CodeTask가 모두 검증 완료되지 않아 통합 단계를 실행할 수 없습니다.",
      timelineEntries: timeline,
    };
  }

  let steps = [...loadImplementationIntegrationStepsFromState(state)];
  if (!findIntegrationStep(steps, "final_wiring")) {
    return {
      ok: false,
      status: "step_missing",
      previewReady: false,
      userSafeMessage: "최종 연결/통합 Wiring 단계가 구성되지 않았습니다.",
      timelineEntries: timeline,
    };
  }

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
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_integration_final_wiring_started",
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: pid, trigger: input.trigger },
        nowIso,
      }),
    );

    const legacy = await runLegacyIntegrationBranchPipelineAsFinalWiringAdapter({
      projectId: pid,
      repoUrl: input.repoUrl,
      baseBranch: input.baseBranch,
      githubToken: input.githubToken,
      codeTaskPlan: input.codeTaskPlan,
      taskList: input.taskList,
      codeTaskRuns: input.codeTaskRuns,
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      createPullRequest: input.createPullRequest,
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
    steps = [...applied.steps];

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

    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_integration_final_wiring_completed",
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: pid, integrationBranch: legacy.integrationBranch },
        nowIso,
      }),
    );
  }

  const buildResult = runBuildIntegrationStep({
    projectId: pid,
    steps,
    plan,
    nowIso,
  });
  steps = [...buildResult.steps];
  timeline.push(...buildResult.timelineEntries);
  orchestrationPatch = persistIntegrationStepsPatch({
    orchestrationPatch,
    projectId: pid,
    steps,
    reason: buildResult.ok ? "implementation_integration_build_completed" : "implementation_integration_build_failed",
    nowIso,
  });

  if (!buildResult.ok) {
    return {
      ok: false,
      status: "build_failed",
      previewReady: false,
      nextRequiredStep: "build",
      userSafeMessage: buildResult.userSafeMessage,
      plan: plan ?? undefined,
      orchestrationPatch,
      integrationBranch: plan?.integrationBranch ?? null,
      timelineEntries: timeline,
    };
  }

  const previewResult = runAppPreviewTargetIntegrationStep({
    projectId: pid,
    steps,
    plan,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    codeTaskRuns: input.codeTaskRuns,
    nowIso,
  });
  steps = [...previewResult.steps];
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
    return {
      ok: false,
      status: "app_preview_target_failed",
      previewReady: false,
      nextRequiredStep: "app_preview_target",
      userSafeMessage: previewResult.userSafeMessage,
      plan: plan ?? undefined,
      previewRuntimePatch,
      orchestrationPatch,
      integrationBranch: plan?.integrationBranch ?? null,
      previewUrl: previewResult.previewUrl ?? null,
      timelineEntries: timeline,
    };
  }

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
      integrationBranch: plan?.integrationBranch ?? null,
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
    integrationBranch: plan?.integrationBranch ?? null,
    previewUrl: previewResult.previewUrl ?? null,
    userSafeMessage: "통합 단계는 진행됐지만 Integrated App Preview 조건이 아직 충족되지 않았습니다.",
    timelineEntries: timeline,
  };
}
