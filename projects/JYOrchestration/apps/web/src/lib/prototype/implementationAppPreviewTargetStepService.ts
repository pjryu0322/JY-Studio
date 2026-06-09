import {
  isIntegratedAppRenderTarget,
  resolveImplementationAppPreviewTarget,
} from "@/lib/prototype/implementationAppPreviewTarget";
import { buildPreviewFromCompletedCodeTasks } from "@/lib/prototype/buildPreviewFromCompletedCodeTasks";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { integrateCompletedCodeTasksForPreview } from "@/lib/prototype/implementationIntegrationService";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import {
  findIntegrationStep,
  mapIntegrationStepByKind,
} from "@/lib/prototype/implementationIntegrationStepMutations";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
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
}): RunAppPreviewTargetIntegrationStepResultV1 {
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

  const integration = integrateCompletedCodeTasksForPreview({
    codeTaskPlan: input.codeTaskPlan,
    taskList: input.taskList,
    codeTaskRuns: input.codeTaskRuns,
    generatedAt: input.nowIso,
  });
  if (!integration.ok) {
    steps = mapIntegrationStepByKind(steps, "app_preview_target", (s) => ({
      ...s,
      status: "failed",
      failedAt: input.nowIso,
      errorCode: "preview_scope_failed",
      errorMessage: integration.message,
    }));
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_integration_app_preview_target_failed",
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: input.projectId, reason: integration.message },
        nowIso: input.nowIso,
      }),
    );
    return {
      ok: false,
      steps,
      timelineEntries: timeline,
      userSafeMessage: integration.message,
    };
  }

  const previewBuild = buildPreviewFromCompletedCodeTasks({
    projectId: input.projectId,
    previewScope: integration.previewScope,
    nowIso: input.nowIso,
    sourceIntegrationBranch: input.plan?.integrationBranch ?? null,
  });

  const runtime = previewBuild.runtime;
  const renderOk = isIntegratedAppRenderTarget({
    runtime,
    integrationPlan: input.plan,
    projectId: input.projectId,
  });
  const target = resolveImplementationAppPreviewTarget({
    projectId: input.projectId,
    runtime,
    integrationPlan: input.plan,
  });
  const hasEntryOnly =
    !renderOk &&
    (Boolean(target.appEntryPath?.trim()) ||
      Boolean(target.previewUrl?.trim()) ||
      Boolean(target.externalPreviewUrl?.trim()));

  if (hasEntryOnly) {
    const message =
      "app entry는 확인됐지만 실제 앱 Preview target을 아직 준비하지 못했습니다.\nPreview 준비를 다시 실행해 주세요.";
    steps = mapIntegrationStepByKind(steps, "app_preview_target", (s) => ({
      ...s,
      status: "pending",
      errorCode: "app_preview_target_partial",
      errorMessage: message,
    }));
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_integration_app_preview_target_failed",
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: input.projectId, reason: "app_preview_target_partial" },
        nowIso: input.nowIso,
      }),
    );
    return {
      ok: false,
      steps,
      timelineEntries: timeline,
      previewRuntime: runtime,
      userSafeMessage: message,
      previewRuntimePatch: previewBuild.ok
        ? {
            implementationPreviewScopeV1: integration.previewScope,
            implementationPreviewRuntimeV1: runtime,
          }
        : undefined,
    };
  }

  const hasTarget = renderOk;

  if (!previewBuild.ok || !hasTarget) {
    const message =
      previewBuild.errorMessage?.trim() ||
      "통합 branch는 준비됐지만 app Preview target을 resolve하지 못했습니다.";
    steps = mapIntegrationStepByKind(steps, "app_preview_target", (s) => ({
      ...s,
      status: "failed",
      failedAt: input.nowIso,
      errorCode: "app_preview_target_missing",
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
      previewRuntime: runtime,
      userSafeMessage: message,
      previewRuntimePatch: { implementationPreviewRuntimeV1: runtime },
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
        previewUrl: previewBuild.previewUrl ?? null,
      },
      nowIso: input.nowIso,
    }),
  );

  return {
    ok: true,
    steps,
    timelineEntries: timeline,
    previewRuntime: runtime,
    previewUrl: previewBuild.previewUrl ?? null,
    previewRuntimePatch: {
      implementationPreviewScopeV1: integration.previewScope,
      implementationPreviewRuntimeV1: runtime,
    },
  };
}
