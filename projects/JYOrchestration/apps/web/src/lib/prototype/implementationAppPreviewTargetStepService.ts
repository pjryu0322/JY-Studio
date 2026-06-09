import {
  buildActualIntegratedAppPreviewRuntime,
  resolveActualIntegratedAppPreviewTarget,
} from "@/lib/prototype/actualIntegratedAppPreviewResolver";
import { deployIntegratedPreviewToGitHubPages } from "@/lib/prototype/githubPagesPreviewDeploymentService";
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
import { resolveGithubOwnerRepoStrict } from "@/lib/integration/githubRestCommon";

export type AppPreviewTargetPipelineStatusV1 =
  | "app_preview_target_failed"
  | "static_preview_artifact_missing"
  | "github_pages_not_configured"
  | "github_pages_deploy_pending";

export type RunAppPreviewTargetIntegrationStepResultV1 = Readonly<{
  readonly ok: boolean;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly previewRuntime?: ImplementationPreviewRuntimeV1;
  readonly previewUrl?: string | null;
  readonly previewRuntimePatch?: Partial<RequirementsStateJson>;
  readonly userSafeMessage?: string | null;
  readonly pipelineStatus?: AppPreviewTargetPipelineStatusV1;
}>;

function completeAppPreviewTargetStep(input: {
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly runtime: ImplementationPreviewRuntimeV1;
  readonly nowIso: string;
  readonly timeline: RequirementsPromptTimelineEntry[];
}): RunAppPreviewTargetIntegrationStepResultV1 {
  const steps = mapIntegrationStepByKind(input.steps, "app_preview_target", (s) => ({
    ...s,
    status: "completed",
    completedAt: input.nowIso,
  }));
  input.timeline.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_integration_app_preview_target_completed",
      orchestrationTraceGroup: "implementation_integration",
      fields: {
        projectId: input.projectId,
        previewUrl: input.runtime.previewUrl ?? null,
        runtimeKind: input.runtime.runtimeKind ?? null,
      },
      nowIso: input.nowIso,
    }),
  );
  return {
    ok: true,
    steps,
    timelineEntries: input.timeline,
    previewRuntime: input.runtime,
    previewUrl: input.runtime.previewUrl ?? null,
    previewRuntimePatch: {
      implementationPreviewRuntimeV1: input.runtime,
    },
  };
}

export async function runAppPreviewTargetIntegrationStep(input: {
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly plan: CodeTaskIntegrationPlanV1 | null;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly codeTaskRuns: readonly CodeTaskExecutionRunV1[] | null;
  readonly nowIso: string;
  readonly projectPreviewSettings?: unknown;
  readonly externalPreviewUrl?: string | null;
  readonly repoUrl?: string | null;
  readonly githubToken?: string | null;
  readonly baseBranch?: string | null;
}): Promise<RunAppPreviewTargetIntegrationStepResultV1> {
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
      pipelineStatus: "app_preview_target_failed",
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

  if (!target.ok && integrationBranch) {
    const repoUrl = String(input.repoUrl ?? "").trim();
    const token = String(input.githubToken ?? "").trim();
    if (repoUrl && token) {
      const parsed = resolveGithubOwnerRepoStrict(repoUrl);
      const deploy = await deployIntegratedPreviewToGitHubPages({
        projectId: input.projectId,
        repositoryFullName: parsed ? `${parsed.owner}/${parsed.repo}` : repoUrl,
        repoUrl,
        githubToken: token,
        integrationBranch,
        fallbackBaseBranch: input.baseBranch?.trim() || "main",
        nowIso: input.nowIso,
      });
      timeline.push(...deploy.timelineEntries);

      if (deploy.ok && deploy.previewRuntime) {
        const runtime = deploy.previewRuntime;
        if (
          isActualIntegratedAppPreviewRuntime({
            projectId: input.projectId,
            runtime,
          })
        ) {
          return completeAppPreviewTargetStep({
            projectId: input.projectId,
            steps,
            runtime,
            nowIso: input.nowIso,
            timeline,
          });
        }
      }

      const pipelineStatus =
        (deploy.pipelineStatus as AppPreviewTargetPipelineStatusV1 | undefined) ??
        "app_preview_target_failed";

      if (pipelineStatus === "github_pages_deploy_pending") {
        const message =
          deploy.deployment.userSafeMessage?.trim() ||
          "GitHub Pages Preview 배포가 시작되었습니다. 잠시 후 Preview 상태를 다시 확인해 주세요.";
        steps = mapIntegrationStepByKind(steps, "app_preview_target", (s) => ({
          ...s,
          status: "pending",
          errorMessage: message,
        }));
        timeline.push(
          buildImplementationExecutionLogTimelineEntry({
            action: "implementation_integration_app_preview_target_pending",
            orchestrationTraceGroup: "implementation_integration",
            fields: { projectId: input.projectId, reason: "github_pages_deploy_pending" },
            nowIso: input.nowIso,
          }),
        );
        return {
          ok: false,
          steps,
          timelineEntries: timeline,
          userSafeMessage: message,
          pipelineStatus,
        };
      }

      const message =
        deploy.deployment.userSafeMessage?.trim() ||
        "GitHub Pages Preview 배포에 실패했습니다.";
      steps = mapIntegrationStepByKind(steps, "app_preview_target", (s) => ({
        ...s,
        status: "failed",
        failedAt: input.nowIso,
        errorCode: deploy.deployment.errorCode ?? "app_preview_target_failed",
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
        pipelineStatus,
      };
    }
  }

  if (!target.ok) {
    const message =
      target.reason?.trim() ||
      "앱 진입점은 확인됐지만 실행 가능한 Preview URL은 아직 준비되지 않았습니다.";
    steps = mapIntegrationStepByKind(steps, "app_preview_target", (s) => ({
      ...s,
      status: integrationBranch ? "failed" : "failed",
      failedAt: input.nowIso,
      errorCode: integrationBranch ? "app_preview_target_missing_url" : "app_preview_target_missing",
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
      pipelineStatus: "app_preview_target_failed",
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
      pipelineStatus: "app_preview_target_failed",
    };
  }

  return completeAppPreviewTargetStep({
    projectId: input.projectId,
    steps,
    runtime,
    nowIso: input.nowIso,
    timeline,
  });
}
