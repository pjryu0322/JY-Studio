import {
  buildActualIntegratedAppPreviewRuntime,
  resolveActualIntegratedAppPreviewTarget,
} from "@/lib/prototype/actualIntegratedAppPreviewResolver";
import { deployIntegratedPreviewToGitHubPages } from "@/lib/prototype/githubPagesPreviewDeploymentService";
import {
  INTEGRATION_PREVIEW_PREFLIGHT_CONFIRMED_USER_MESSAGE,
  runIntegrationPreviewPreflight,
} from "@/lib/prototype/integrationPreviewPreflightService";
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
import {
  isIntegrationSampleDataArtifactFailure,
  sampleDataQualityUserMessage,
} from "@/lib/prototype/actualPreviewSampleDataQualityGate";
import { runActualPreviewSampleDataQualityOnIntegrationBranch } from "@/lib/prototype/actualPreviewSampleDataQualityLoader";
import { checkPreviewSampleDataRendered } from "@/lib/prototype/actualPreviewSampleDataRenderedGate";
import {
  buildPreviewSampleDataReadinessFromQualityResult,
  patchPreviewRuntimeSampleDataGate,
} from "@/lib/prototype/implementationPreviewSampleDataReadiness";
import { fetchRepositoryFilePathsForBranch } from "@/lib/prototype/githubPagesPreviewDeploymentService";

export type AppPreviewTargetPipelineStatusV1 =
  | "app_preview_target_failed"
  | "static_preview_artifact_missing"
  | "github_pages_not_configured"
  | "github_pages_deploy_pending"
  | "github_preview_permission_required"
  | "github_pages_setup_required"
  | "github_preview_workflow_setup_required"
  | "github_preview_workflow_request_invalid"
  | "github_actions_setup_required"
  | "github_preview_retry_required"
  | "github_preview_operator_review_required"
  | "sample_data_required"
  | "sample_data_not_rendered";

export type RunAppPreviewTargetIntegrationStepResultV1 = Readonly<{
  readonly ok: boolean;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly previewRuntime?: ImplementationPreviewRuntimeV1;
  readonly previewUrl?: string | null;
  readonly previewRuntimePatch?: Partial<RequirementsStateJson>;
  readonly userSafeMessage?: string | null;
  readonly pipelineStatus?: AppPreviewTargetPipelineStatusV1;
  readonly executionSetupCapabilityPatch?: Record<string, unknown> | null;
  readonly previewPreflightCheckedAt?: string | null;
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

async function blockIfSampleDataQualityInsufficient(input: {
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly integrationBranch: string;
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly nowIso: string;
  readonly timeline: RequirementsPromptTimelineEntry[];
}): Promise<RunAppPreviewTargetIntegrationStepResultV1 | null> {
  const listed = await fetchRepositoryFilePathsForBranch({
    repoUrl: input.repoUrl,
    githubToken: input.githubToken,
    branch: input.integrationBranch,
  });
  const quality = await runActualPreviewSampleDataQualityOnIntegrationBranch({
    repoUrl: input.repoUrl,
    githubToken: input.githubToken,
    integrationBranch: input.integrationBranch,
    repositoryFilePaths: listed.ok ? listed.filePaths : undefined,
    mode: "integration_merge",
  });
  if (quality.panelPlaceholderWarnings?.length) {
    input.timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "actual_preview_panel_wiring_deferred",
        orchestrationTraceGroup: "implementation_integration",
        fields: {
          projectId: input.projectId,
          integrationBranch: input.integrationBranch,
          warning: quality.panelPlaceholderWarnings,
        },
        nowIso: input.nowIso,
      }),
    );
  }
  if (quality.result.ok) {
    input.timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "sample_data_codetask_outcome_verified",
        orchestrationTraceGroup: "implementation_integration",
        fields: { projectId: input.projectId, integrationBranch: input.integrationBranch },
        nowIso: input.nowIso,
      }),
    );
    return null;
  }
  if (!isIntegrationSampleDataArtifactFailure(quality.result)) {
    return null;
  }
  const message = sampleDataQualityUserMessage();
  const steps = mapIntegrationStepByKind(input.steps, "app_preview_target", (s) => ({
    ...s,
    status: "failed",
    failedAt: input.nowIso,
    errorCode: "sample_data_required",
    errorMessage: message,
  }));
  input.timeline.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "actual_preview_sample_data_quality_failed",
      orchestrationTraceGroup: "implementation_integration",
      fields: {
        projectId: input.projectId,
        missing: quality.result.missing,
        warning: quality.result.warning,
      },
      nowIso: input.nowIso,
    }),
  );
  return {
    ok: false,
    steps,
    timelineEntries: input.timeline,
    userSafeMessage: message,
    pipelineStatus: "sample_data_required",
  };
}

async function applySampleDataGatesBeforePreviewComplete(input: {
  readonly projectId: string;
  readonly steps: readonly ImplementationIntegrationStepV1[];
  readonly integrationBranch: string;
  readonly repoUrl: string;
  readonly githubToken: string;
  readonly nowIso: string;
  readonly timeline: RequirementsPromptTimelineEntry[];
  readonly runtime: ImplementationPreviewRuntimeV1;
}): Promise<
  | Readonly<{ readonly runtime: ImplementationPreviewRuntimeV1 }>
  | RunAppPreviewTargetIntegrationStepResultV1
> {
  const sampleBlock = await blockIfSampleDataQualityInsufficient({
    projectId: input.projectId,
    steps: input.steps,
    integrationBranch: input.integrationBranch,
    repoUrl: input.repoUrl,
    githubToken: input.githubToken,
    nowIso: input.nowIso,
    timeline: input.timeline,
  });
  if (sampleBlock) return sampleBlock;

  const listed = await fetchRepositoryFilePathsForBranch({
    repoUrl: input.repoUrl,
    githubToken: input.githubToken,
    branch: input.integrationBranch,
  });
  const quality = await runActualPreviewSampleDataQualityOnIntegrationBranch({
    repoUrl: input.repoUrl,
    githubToken: input.githubToken,
    integrationBranch: input.integrationBranch,
    repositoryFilePaths: listed.ok ? listed.filePaths : undefined,
    mode: "integration_merge",
  });

  const previewUrl =
    String(input.runtime.externalPreviewUrl ?? "").trim() ||
    String(input.runtime.githubPagesUrl ?? "").trim() ||
    String(input.runtime.previewUrl ?? "").trim();

  const rendered = previewUrl
    ? await checkPreviewSampleDataRendered({ previewUrl })
    : {
        ok: false,
        status: "preview_unreachable" as const,
        foundMarkers: [],
        missingMarkers: [],
        issues: ["missing_preview_url_for_rendered_check"],
      };

  const gate = buildPreviewSampleDataReadinessFromQualityResult({
    quality: quality.result,
    renderedOk: rendered.ok,
    renderedStatus: rendered.ok ? "ready" : "not_rendered",
    renderedIssues: rendered.issues,
  });

  if (!rendered.ok) {
    const message =
      "Preview는 열렸지만 샘플 데이터가 화면에 표시되지 않았습니다.";
    const steps = mapIntegrationStepByKind(input.steps, "app_preview_target", (s) => ({
      ...s,
      status: "failed",
      failedAt: input.nowIso,
      errorCode: "sample_data_not_rendered",
      errorMessage: message,
    }));
    input.timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "actual_preview_sample_data_not_rendered",
        orchestrationTraceGroup: "implementation_integration",
        fields: {
          projectId: input.projectId,
          previewUrl,
          renderedStatus: rendered.status,
          issues: rendered.issues,
        },
        nowIso: input.nowIso,
      }),
    );
    return {
      ok: false,
      steps,
      timelineEntries: input.timeline,
      userSafeMessage: message,
      pipelineStatus: "sample_data_not_rendered",
      previewRuntime: patchPreviewRuntimeSampleDataGate(input.runtime, gate),
      previewRuntimePatch: {
        implementationPreviewRuntimeV1: patchPreviewRuntimeSampleDataGate(input.runtime, gate),
      },
    };
  }

  input.timeline.push(
    buildImplementationExecutionLogTimelineEntry({
      action: "actual_preview_sample_data_rendered_verified",
      orchestrationTraceGroup: "implementation_integration",
      fields: {
        projectId: input.projectId,
        previewUrl,
        renderedStatus: rendered.status,
      },
      nowIso: input.nowIso,
    }),
  );

  return {
    runtime: patchPreviewRuntimeSampleDataGate(input.runtime, gate),
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
  readonly capabilitySnapshot?: unknown;
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
      const ownerRepo = parsed ? `${parsed.owner}/${parsed.repo}` : repoUrl;
      const defaultBranch = input.baseBranch?.trim() || "main";

      const preflight = await runIntegrationPreviewPreflight({
        ownerRepo,
        defaultBranch,
        githubToken: token,
        capabilitySnapshot: input.capabilitySnapshot as never,
        projectId: input.projectId,
        integrationBranch,
        integrationRunStartedAt: input.nowIso,
      });

      if (!preflight.ok) {
        const message = preflight.userSafeMessage;
        steps = mapIntegrationStepByKind(steps, "app_preview_target", (s) => ({
          ...s,
          status: "pending",
          errorMessage: message,
        }));
        const timelineAction =
          preflight.kind === "github_pages_setup_required"
            ? "github_pages_setup_required"
            : preflight.kind === "github_preview_permission_required"
              ? "github_actions_permission_required"
              : "integration_preview_preflight_failed";
        timeline.push(
          buildImplementationExecutionLogTimelineEntry({
            action: timelineAction,
            orchestrationTraceGroup: "implementation_integration",
            fields: {
              projectId: input.projectId,
              remediationCode: preflight.remediationCode,
              requiredPermission: preflight.kind,
              previewPreflightCheckedAt: preflight.checkedAt,
            },
            nowIso: input.nowIso,
          }),
        );
        timeline.push(
          buildImplementationExecutionLogTimelineEntry({
            action: "implementation_integration_app_preview_target_user_action_required",
            orchestrationTraceGroup: "implementation_integration",
            fields: { projectId: input.projectId, reason: preflight.kind },
            nowIso: input.nowIso,
          }),
        );
        return {
          ok: false,
          steps,
          timelineEntries: timeline,
          userSafeMessage: message,
          pipelineStatus: preflight.kind,
          executionSetupCapabilityPatch: preflight.capabilityPatch ?? null,
          previewPreflightCheckedAt: preflight.checkedAt,
        };
      }

      timeline.push(
        buildImplementationExecutionLogTimelineEntry({
          action: "integration_preview_preflight_live_refresh_completed",
          orchestrationTraceGroup: "implementation_integration",
          fields: {
            projectId: input.projectId,
            previewPreflightCheckedAt: preflight.checkedAt,
          },
          nowIso: input.nowIso,
        }),
      );

      const deployCapabilityPatch = preflight.capabilityPatch ?? null;

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

      const attachPreflightPatch = <T extends RunAppPreviewTargetIntegrationStepResultV1>(
        result: T,
      ): T => ({
        ...result,
        executionSetupCapabilityPatch: deployCapabilityPatch,
        previewPreflightCheckedAt: preflight.checkedAt,
      });

      if (deploy.ok && deploy.previewRuntime) {
        const runtime = deploy.previewRuntime;
        if (
          isActualIntegratedAppPreviewRuntime({
            projectId: input.projectId,
            runtime,
          })
        ) {
          const sampleGate = await applySampleDataGatesBeforePreviewComplete({
            projectId: input.projectId,
            steps,
            integrationBranch,
            repoUrl,
            githubToken: token,
            nowIso: input.nowIso,
            timeline,
            runtime,
          });
          if ("ok" in sampleGate && sampleGate.ok === false) {
            return attachPreflightPatch(sampleGate);
          }
          const gatedRuntime = "runtime" in sampleGate ? sampleGate.runtime : runtime;
          return attachPreflightPatch(
            completeAppPreviewTargetStep({
              projectId: input.projectId,
              steps,
              runtime: gatedRuntime,
              nowIso: input.nowIso,
              timeline,
            }),
          );
        }
      }

      const pipelineStatus =
        (deploy.pipelineStatus as AppPreviewTargetPipelineStatusV1 | undefined) ??
        "app_preview_target_failed";

      if (pipelineStatus === "github_pages_deploy_pending") {
        const message =
          deploy.deployment.userSafeMessage?.trim() ||
          INTEGRATION_PREVIEW_PREFLIGHT_CONFIRMED_USER_MESSAGE;
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
        return attachPreflightPatch({
          ok: false,
          steps,
          timelineEntries: timeline,
          userSafeMessage: message,
          pipelineStatus,
        });
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
      return attachPreflightPatch({
        ok: false,
        steps,
        timelineEntries: timeline,
        userSafeMessage: message,
        pipelineStatus,
      });
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

  const repoUrlForQuality = String(input.repoUrl ?? "").trim();
  const tokenForQuality = String(input.githubToken ?? "").trim();
  if (integrationBranch && repoUrlForQuality && tokenForQuality) {
    const sampleGate = await applySampleDataGatesBeforePreviewComplete({
      projectId: input.projectId,
      steps,
      integrationBranch,
      repoUrl: repoUrlForQuality,
      githubToken: tokenForQuality,
      nowIso: input.nowIso,
      timeline,
      runtime,
    });
    if ("ok" in sampleGate && sampleGate.ok === false) {
      return sampleGate;
    }
    const gatedRuntime = "runtime" in sampleGate ? sampleGate.runtime : runtime;
    return completeAppPreviewTargetStep({
      projectId: input.projectId,
      steps,
      runtime: gatedRuntime,
      nowIso: input.nowIso,
      timeline,
    });
  }

  return completeAppPreviewTargetStep({
    projectId: input.projectId,
    steps,
    runtime,
    nowIso: input.nowIso,
    timeline,
  });
}
