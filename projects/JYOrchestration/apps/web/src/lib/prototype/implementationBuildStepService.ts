import { asReadonlyArray } from "@/lib/prototype/implementationIntegrationPlanNormalize";
import { integrationPlanHasSuccessfulMerge } from "@/lib/prototype/implementationIntegrationPlanMergeStatus";
import {
  resolveImplementationAppPreviewTarget,
  resolveIntegrationPlanBuildStatus,
} from "@/lib/prototype/implementationAppPreviewTarget";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import type { ImplementationIntegrationStepV1 } from "@/lib/prototype/implementationIntegrationStep";
import {
  findIntegrationStep,
  mapIntegrationStepByKind,
} from "@/lib/prototype/implementationIntegrationStepMutations";
import { isStaticBuildStepSatisfied } from "@/lib/prototype/staticAppBuildContractResolver";

export type RunBuildIntegrationStepResultV1 = Readonly<{
  readonly ok: boolean;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly userSafeMessage?: string | null;
}>;

export function evaluateBuildIntegrationStepCompletion(input: {
  readonly plan: CodeTaskIntegrationPlanV1 | null;
  readonly projectId: string;
  readonly repositoryFiles?: readonly string[] | null;
  readonly packageJson?: unknown;
  readonly hasExternalOrLocalPreview?: boolean;
}): Readonly<{ readonly ok: boolean; readonly errorCode?: string; readonly message?: string }> {
  const plan = input.plan;
  if (!plan?.integrationBranch?.trim()) {
    return { ok: false, errorCode: "missing_integration_branch", message: "통합 branch가 없습니다." };
  }
  const buildStatus = resolveIntegrationPlanBuildStatus(plan);
  if (buildStatus === "failed" || plan.status === "failed" || plan.status === "conflict") {
    return {
      ok: false,
      errorCode: "build_check_failed",
      message: plan.failureMessage?.trim() || "build 검증에 실패했습니다.",
    };
  }
  const target = resolveImplementationAppPreviewTarget({
    projectId: input.projectId,
    integrationPlan: plan,
  });
  const hasEntryCandidate =
    Boolean(target.appEntryPath?.trim()) ||
    Boolean(target.previewUrl?.trim()) ||
    Boolean(target.externalPreviewUrl?.trim()) ||
    asReadonlyArray(plan.included).length > 0;
  if (!hasEntryCandidate) {
    return {
      ok: false,
      errorCode: "app_entry_missing",
      message: "app entry 후보를 찾을 수 없습니다.",
    };
  }
  if (buildStatus === "passed" || plan.status === "preview_ready" || plan.status === "pr_ready") {
    return { ok: true };
  }
  if (input.repositoryFiles && input.repositoryFiles.length > 0) {
    if (
      isStaticBuildStepSatisfied({
        repositoryFiles: input.repositoryFiles,
        packageJson: input.packageJson,
        hasExternalOrLocalPreview: input.hasExternalOrLocalPreview,
      })
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      errorCode: "static_build_not_ready",
      message:
        "GitHub Pages로 배포할 정적 빌드 산출물 또는 빌드 설정이 아직 준비되지 않았습니다.\n통합 branch에 dist/out/build 또는 Vite 빌드 설정이 필요합니다.",
    };
  }
  if (integrationPlanHasSuccessfulMerge(plan)) {
    return { ok: true };
  }
  return {
    ok: false,
    errorCode: "build_check_pending",
    message: "Build 검증을 완료하지 못했습니다.\n다시 시도해 주세요.",
  };
}

export async function runBuildIntegrationStep(input: {
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly plan: CodeTaskIntegrationPlanV1 | null;
  readonly nowIso: string;
  readonly repositoryFiles?: readonly string[] | null;
  readonly packageJson?: unknown;
  readonly hasExternalOrLocalPreview?: boolean;
}): Promise<RunBuildIntegrationStepResultV1> {
  const buildStep = findIntegrationStep(input.steps, "build");
  const timeline: RequirementsPromptTimelineEntry[] = [];
  if (!buildStep) {
    return { ok: true, steps: input.steps, timelineEntries: timeline };
  }
  if (buildStep.status === "completed") {
    return { ok: true, steps: input.steps, timelineEntries: timeline };
  }
  if (buildStep.status === "failed") {
    return {
      ok: false,
      steps: input.steps,
      timelineEntries: timeline,
      userSafeMessage: buildStep.errorMessage ?? "build 검증에 실패했습니다.",
    };
  }

  let steps = mapIntegrationStepByKind(input.steps, "build", (s) => ({
    ...s,
    status: "running",
    startedAt: input.nowIso,
  }));
  timeline.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_integration_build_started",
      orchestrationTraceGroup: "implementation_integration",
      fields: { projectId: input.projectId, stepId: buildStep.stepId },
      nowIso: input.nowIso,
    }),
  );

  const evaluation = evaluateBuildIntegrationStepCompletion({
    plan: input.plan,
    projectId: input.projectId,
    repositoryFiles: input.repositoryFiles,
    packageJson: input.packageJson,
    hasExternalOrLocalPreview: input.hasExternalOrLocalPreview,
  });
  if (evaluation.ok) {
    steps = mapIntegrationStepByKind(steps, "build", (s) => ({
      ...s,
      status: "completed",
      completedAt: input.nowIso,
    }));
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_integration_build_completed",
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: input.projectId, stepId: buildStep.stepId },
        nowIso: input.nowIso,
      }),
    );
    return { ok: true, steps, timelineEntries: timeline };
  }

  steps = mapIntegrationStepByKind(steps, "build", (s) => ({
    ...s,
    status: "failed",
    failedAt: input.nowIso,
    errorCode: evaluation.errorCode ?? "build_failed",
    errorMessage: evaluation.message ?? "build 검증에 실패했습니다.",
  }));
  timeline.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_integration_build_failed",
      orchestrationTraceGroup: "implementation_integration",
      fields: {
        projectId: input.projectId,
        stepId: buildStep.stepId,
        reason: evaluation.message ?? "build_failed",
      },
      nowIso: input.nowIso,
    }),
  );
  return {
    ok: false,
    steps,
    timelineEntries: timeline,
    userSafeMessage: evaluation.message ?? "build 검증에 실패했습니다.",
  };
}
