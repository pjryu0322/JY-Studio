import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  areAllSelectedExecutionUnitsVerifiedWithRuns,
} from "@/lib/prototype/implementationExecutionSelectedUnits";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { INTEGRATION_FINAL_WIRING_STEP_ID } from "@/lib/prototype/implementationIntegrationStep";
import { ensurePersistedImplementationIntegrationSteps } from "@/lib/prototype/implementationIntegrationStepBootstrap";
import {
  findIntegrationStepByKind,
  loadImplementationIntegrationStepsFromState,
  saveImplementationIntegrationStepsToState,
} from "@/lib/prototype/implementationIntegrationStepStore";
import { runIntegrationBranchPipeline } from "@/lib/prototype/implementationIntegrationPipelineService";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";

export type RunFinalWiringIntegrationStepResultV1 = Readonly<{
  readonly ok: boolean;
  readonly status:
    | "final_wiring_completed"
    | "final_wiring_failed"
    | "codetasks_incomplete"
    | "step_missing"
    | "pipeline_failed";
  readonly integrationBranch?: string | null;
  readonly previewReady?: boolean;
  readonly nextRequiredStep?: string | null;
  readonly userSafeMessage?: string | null;
  readonly plan?: CodeTaskIntegrationPlanV1;
  readonly orchestrationPatch?: Partial<RequirementsStateJson>;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
}>;

export async function markFinalWiringIntegrationStepReady(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly nowIso?: string;
}): Promise<
  Readonly<{
    readonly orchestrationPatch: Partial<RequirementsStateJson>;
    readonly timeline: readonly RequirementsPromptTimelineEntry[];
  }>
> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const ensured = ensurePersistedImplementationIntegrationSteps({
    projectId: pid,
    requirementsState: input.requirementsState,
    codeTaskPlan: input.codeTaskPlan,
    nowIso,
  });
  let state = mergeRequirementsStateJson(input.requirementsState, ensured.orchestrationPatch);
  const steps = loadImplementationIntegrationStepsFromState(state);
  const finalWiring = findIntegrationStepByKind(steps, "final_wiring");
  if (!finalWiring || finalWiring.status !== "pending") {
    return { orchestrationPatch: ensured.orchestrationPatch, timeline: ensured.timeline };
  }
  const summary = buildImplementationExecutionSummaryCounts({
    projectId: pid,
    requirementsState: state,
    codeTaskPlan: input.codeTaskPlan,
    runs: input.runs,
  });
  if (
    !areAllSelectedExecutionUnitsVerifiedWithRuns({
      units: summary.executionUnits,
      selectedUnitIds: summary.selectedExecutionUnitIds,
      runs: input.runs,
    })
  ) {
    return { orchestrationPatch: ensured.orchestrationPatch, timeline: ensured.timeline };
  }
  const nextSteps = steps.map((s) =>
    s.stepId === finalWiring.stepId && s.status === "pending" ? { ...s, status: "ready" as const } : s,
  );
  const stepPatch = saveImplementationIntegrationStepsToState({
    projectId: pid,
    steps: nextSteps,
    reason: "implementation_integration_final_wiring_ready",
    nowIso,
  });
  const timeline: RequirementsPromptTimelineEntry[] = [
    ...ensured.timeline,
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_integration_final_wiring_ready",
      orchestrationTraceGroup: "implementation_integration",
      fields: { projectId: pid, stepId: finalWiring.stepId },
      nowIso,
    }),
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_codetasks_completed",
      orchestrationTraceGroup: "implementation_orchestration",
      fields: {
        projectId: pid,
        selectedCount: summary.selectedExecutionUnitIds.length,
        verifiedCount: summary.completedCodeTaskCount,
      },
      nowIso,
    }),
  ];
  return {
    orchestrationPatch: mergeOrchestrationPersistPatches(ensured.orchestrationPatch, stepPatch),
    timeline,
  };
}

export async function runFinalWiringIntegrationStep(input: {
  readonly projectId: string;
  readonly stepId?: string;
  readonly trigger: "auto_after_codetasks_verified" | "manual_integration_button";
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
}): Promise<RunFinalWiringIntegrationStepResultV1> {
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
      userSafeMessage: "선택한 CodeTask가 모두 검증 완료되지 않아 통합 단계를 실행할 수 없습니다.",
      timelineEntries: timeline,
    };
  }

  const steps = loadImplementationIntegrationStepsFromState(state);
  const stepId = (input.stepId ?? INTEGRATION_FINAL_WIRING_STEP_ID).trim();
  const finalWiring = steps.find((s) => s.stepId === stepId) ?? findIntegrationStepByKind(steps, "final_wiring");
  if (!finalWiring) {
    return {
      ok: false,
      status: "step_missing",
      userSafeMessage: "최종 연결/통합 Wiring 단계가 구성되지 않았습니다.",
      timelineEntries: timeline,
    };
  }

  if (finalWiring.status === "completed") {
    const branch = String(finalWiring.workBranch ?? "").trim() || null;
    return {
      ok: true,
      status: "final_wiring_completed",
      integrationBranch: branch,
      previewReady: false,
      nextRequiredStep: "build",
      timelineEntries: timeline,
    };
  }

  if (finalWiring.status !== "ready" && finalWiring.status !== "pending" && finalWiring.status !== "running") {
    return {
      ok: false,
      status: "final_wiring_failed",
      userSafeMessage: finalWiring.errorMessage ?? "통합 Wiring 단계가 실패 상태입니다.",
      timelineEntries: timeline,
    };
  }

  const runningSteps = steps.map((s) =>
    s.stepId === finalWiring.stepId
      ? { ...s, status: "running" as const, startedAt: nowIso }
      : s,
  );
  state = mergeRequirementsStateJson(
    state,
    saveImplementationIntegrationStepsToState({
      projectId: pid,
      steps: runningSteps,
      reason: "implementation_integration_final_wiring_started",
      nowIso,
    }),
  );
  timeline.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_integration_final_wiring_started",
      orchestrationTraceGroup: "implementation_integration",
      fields: { projectId: pid, stepId: finalWiring.stepId, trigger: input.trigger },
      nowIso,
    }),
  );

  const outcome = await runIntegrationBranchPipeline({
    projectId: pid,
    repoUrl: input.repoUrl,
    baseBranch: input.baseBranch,
    githubToken: input.githubToken,
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    codeTaskRuns: input.codeTaskRuns,
    selectedCodeTaskIds: input.selectedCodeTaskIds,
    createPullRequest: input.createPullRequest,
    storedIntegrationPlan: input.storedIntegrationPlan,
    nowIso,
  });
  timeline.push(...outcome.timeline);

  if (!outcome.ok) {
    const failedSteps = runningSteps.map((s) =>
      s.stepId === finalWiring.stepId
        ? {
            ...s,
            status: "failed" as const,
            failedAt: nowIso,
            errorCode: "integration_pipeline_failed",
            errorMessage: outcome.message,
          }
        : s,
    );
    const patch = mergeOrchestrationPersistPatches(
      saveImplementationIntegrationStepsToState({
        projectId: pid,
        steps: failedSteps,
        reason: "implementation_integration_final_wiring_failed",
        nowIso,
      }),
      { codeTaskIntegrationPlanV1: outcome.plan },
    );
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_integration_final_wiring_failed",
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: pid, stepId: finalWiring.stepId, reason: outcome.message.slice(0, 200) },
        nowIso,
      }),
    );
    return {
      ok: false,
      status: "pipeline_failed",
      userSafeMessage: outcome.message,
      plan: outcome.plan,
      orchestrationPatch: patch,
      timelineEntries: timeline,
    };
  }

  const integrationBranch =
    String(outcome.plan.integrationBranch ?? finalWiring.workBranch ?? "").trim() || null;
  const completedSteps = runningSteps.map((s) => {
    if (s.stepId === finalWiring.stepId) {
      return {
        ...s,
        status: "completed" as const,
        completedAt: nowIso,
        commitSha: outcome.plan.baseCommitSha ?? s.commitSha ?? null,
      };
    }
    if (s.kind === "integration_branch" && integrationBranch) {
      return { ...s, status: "completed" as const, completedAt: nowIso, workBranch: integrationBranch };
    }
    return s;
  });

  const orchestrationPatch = mergeOrchestrationPersistPatches(
    saveImplementationIntegrationStepsToState({
      projectId: pid,
      steps: completedSteps,
      reason: "implementation_integration_final_wiring_completed",
      nowIso,
    }),
    { codeTaskIntegrationPlanV1: outcome.plan },
  );

  timeline.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_integration_final_wiring_completed",
      orchestrationTraceGroup: "implementation_integration",
      fields: {
        projectId: pid,
        stepId: finalWiring.stepId,
        integrationBranch,
      },
      nowIso,
    }),
  );

  return {
    ok: true,
    status: "final_wiring_completed",
    integrationBranch,
    previewReady: false,
    nextRequiredStep: "build",
    plan: outcome.plan,
    orchestrationPatch,
    timelineEntries: timeline,
  };
}
