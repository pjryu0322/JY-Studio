import {
  buildActualIntegratedAppPreviewRuntime,
  resolveActualIntegratedAppPreviewTarget,
} from "@/lib/prototype/actualIntegratedAppPreviewResolver";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import {
  findIntegrationStep,
  mapIntegrationStepByKind,
} from "@/lib/prototype/implementationIntegrationStepMutations";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { isActualIntegratedAppPreviewRuntime } from "@/lib/prototype/implementationPreviewRuntimeKind";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type RunAppPreviewTargetIntegrationStepResultV1 = Readonly<{
  readonly ok: boolean;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly previewRuntime?: ImplementationPreviewRuntimeV1;
  readonly previewUrl?: string | null;
  readonly previewRuntimePatch?: Partial<RequirementsStateJson>;
  readonly userSafeMessage?: string | null;
}>;

export function runAppPreviewTargetIntegrationStep(input: {
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly plan: CodeTaskIntegrationPlanV1 | null;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly codeTaskRuns: readonly CodeTaskExecutionRunV1[] | null;
  readonly nowIso: string;
  readonly projectPreviewSettings?: unknown;
  readonly externalPreviewUrl?: string | null;
}): RunAppPreviewTargetIntegrationStepResultV1 {
  void input.codeTaskPlan;
  void input.taskList;
  void input.codeTaskRuns;

  const step = findIntegrationStep(input.steps, "app_preview_target");
  const timeline: RequirementsPromptTimelineEntry[] = [];
  if (!step) {
    return { ok: true, steps: input.steps, timelineEntries: timeline };
  }
  if (step.status === "completed") {
    return { ok: true, steps: input.steps, timelineEntries: timeline };
  }
  if (step.status === "failed") {
    return {
      ok: false,
      steps: input.steps,
      timelineEntries: timeline,
      userSafeMessage: step.errorMessage ?? "app Preview target을 준비하지 못했습니다.",
    };
  }

  let steps = mapIntegrationStepByKind(input.steps, "app_preview_target", (s) => ({
    ...s,
    status: "running",
    startedAt: input.nowIso,
  }));
  timeline.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_integration_app_preview_target_started",
      orchestrationTraceGroup: "implementation_integration",
      fields: { projectId: input.projectId, stepId: step.stepId },
      nowIso: input.nowIso,
    }),
  );

  const integrationBranch = input.plan?.integrationBranch ?? null;
  const target = resolveActualIntegratedAppPreviewTarget({
    projectId: input.projectId,
    integrationBranch,
    integrationPlan: input.plan,
    projectPreviewSettings: input.projectPreviewSettings,
    externalPreviewUrl: input.externalPreviewUrl,
  });

  if (!target.ok) {
    const message =
      target.reason?.trim() ||
      "앱 진입점은 확인됐지만 실행 가능한 Preview URL은 아직 준비되지 않았습니다.";
    steps = mapIntegrationStepByKind(steps, "app_preview_target", (s) => ({
      ...s,
      status: integrationBranch ? "pending" : "failed",
      ...(integrationBranch
        ? {}
        : { failedAt: input.nowIso, errorCode: "app_preview_target_missing" }),
      errorMessage: message,
    }));
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_integration_app_preview_target_failed",
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: input.projectId, reason: message.slice(0, 200) },
        nowIso: input.nowIso,
      }),
    );
    return {
      ok: false,
      steps,
      timelineEntries: timeline,
      userSafeMessage: message,
    };
  }

  const runtime = buildActualIntegratedAppPreviewRuntime({
    projectId: input.projectId,
    target,
    nowIso: input.nowIso,
  });

  if (
    !isActualIntegratedAppPreviewRuntime({
      projectId: input.projectId,
      runtime,
    })
  ) {
    const message = "실제 앱 Preview runtime을 준비하지 못했습니다.";
    steps = mapIntegrationStepByKind(steps, "app_preview_target", (s) => ({
      ...s,
      status: "failed",
      failedAt: input.nowIso,
      errorCode: "app_preview_target_invalid_runtime",
      errorMessage: message,
    }));
    return {
      ok: false,
      steps,
      timelineEntries: timeline,
      userSafeMessage: message,
    };
  }

  steps = mapIntegrationStepByKind(steps, "app_preview_target", (s) => ({
    ...s,
    status: "completed",
    completedAt: input.nowIso,
  }));
  timeline.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_integration_app_preview_target_completed",
      orchestrationTraceGroup: "implementation_integration",
      fields: {
        projectId: input.projectId,
        previewUrl: runtime.previewUrl ?? null,
        runtimeKind: runtime.runtimeKind ?? null,
      },
      nowIso: input.nowIso,
    }),
  );

  return {
    ok: true,
    steps,
    timelineEntries: timeline,
    previewRuntime: runtime,
    previewUrl: runtime.previewUrl ?? null,
    previewRuntimePatch: {
      implementationPreviewRuntimeV1: runtime,
    },
  };
}
