import type { ImplementationCodeTaskSelectionSummaryV1 } from "@/lib/prototype/implementationCodeTaskBoardState";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { resolveIntegrationPipelineUserToast } from "@/lib/prototype/implementationIntegrationToastPolicy";
import { runProjectIntegrationPrepareOnly } from "@/lib/prototype/projectIntegrationPipelineClient";
import { toUserSafeIntegrationErrorMessage } from "@/lib/prototype/implementationIntegrationErrors";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  evaluateIntegrationButtonGate,
  INTEGRATION_PIPELINE_START_SUCCESS_TOAST,
  INTEGRATION_PIPELINE_FAILED_USER_MESSAGE,
  isFinalWiringStepReadyForIntegrationButton,
  logIntegrationButtonClicked,
  logPrepareIntegrationPreviewStarted,
} from "@/lib/prototype/implementationBoardIntegrationGate";
import { summarizeCodeTaskBoardGateFromRequirementsState } from "@/lib/prototype/implementationIntegrationBoardGateSummary";
import { findIntegrationStep } from "@/lib/prototype/implementationIntegrationStepMutations";
import { loadImplementationIntegrationStepsFromState } from "@/lib/prototype/implementationIntegrationStepStore";
import { pickIntegrationPipelineClientBoardSummary } from "@/lib/prototype/implementationControlPlaneSnapshot";
import type { ImplementationControlPlaneSnapshotV1 } from "@/lib/prototype/implementationControlPlaneSnapshot";

export type IntegrationPipelineClientSnapshotV1 = Readonly<{
  readonly status: string;
  readonly previewReady: boolean;
  readonly receivedAt: number;
}>;

export async function executeImplementationBoardIntegrationPipeline(input: {
  readonly projectId: string;
  readonly projectName: string;
  readonly requirementsState: RequirementsStateJson;
  readonly requirementsStateJsonRef: { readonly current: unknown };
  readonly implementationBoardBlockingUserConfirmation: number;
  readonly persistChatToDb: (
    chatPatch: undefined,
    orchestrationPatch: Omit<PrototypeExecutionOrchestrationPersistInput, "chat"> | undefined,
    persistSeq: undefined,
    persistOptions?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<{ readonly serverSaved: boolean } | void>;
  readonly applyPendingFromOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput | undefined,
  ) => void;
  readonly showToast: (message: string) => void;
  readonly setBusy: (busy: boolean) => void;
  readonly onClientResult: (snapshot: IntegrationPipelineClientSnapshotV1) => void;
  readonly boardSelectionSummary?: ImplementationCodeTaskSelectionSummaryV1 | null;
  readonly parentControlPlaneSnapshot?: ImplementationControlPlaneSnapshotV1 | null;
}): Promise<void> {
  const pid = input.projectId.trim();
  if (!pid) {
    input.showToast("프로젝트를 선택해 주세요.");
    return;
  }

  logIntegrationButtonClicked({ projectId: pid });

  const clientSummary =
    input.boardSelectionSummary ??
    pickIntegrationPipelineClientBoardSummary({
      bridgeSummary: input.boardSelectionSummary,
      parentSnapshot: input.parentControlPlaneSnapshot ?? null,
    });

  const authoritativeSummary = summarizeCodeTaskBoardGateFromRequirementsState({
    projectId: pid,
    requirementsState: parseRequirementsStateJson(input.requirementsStateJsonRef.current),
  });

  const mergedState = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
  const finalWiringStep = findIntegrationStep(
    loadImplementationIntegrationStepsFromState(mergedState),
    "final_wiring",
  );
  const finalWiringReady = isFinalWiringStepReadyForIntegrationButton(finalWiringStep?.status);

  const integrationGate = evaluateIntegrationButtonGate({
    summary: authoritativeSummary,
    finalWiringReady,
    selectedCount: authoritativeSummary.selectedRunnableCount,
    verifiedCount: authoritativeSummary.integrationReadyCount,
    clientSummary,
    projectId: pid,
  });

  if (!integrationGate.canRun) {
    input.showToast(integrationGate.userMessage ?? "통합을 시작할 수 없습니다.");
    return;
  }
  logPrepareIntegrationPreviewStarted({
    projectId: pid,
    integrationTargetCount: integrationGate.integrationReadyCodeTaskIds.length,
    integrationCodeTaskIds: integrationGate.integrationReadyCodeTaskIds,
  });

  if (
    input.implementationBoardBlockingUserConfirmation > 0 &&
    integrationGate.integrationReadyCodeTaskIds.length === 0
  ) {
    input.showToast("사용자 확인이 필요한 작업이 해소된 뒤 통합을 실행할 수 있습니다.");
    return;
  }

  input.setBusy(true);
  input.showToast(INTEGRATION_PIPELINE_START_SUCCESS_TOAST);
  input.onClientResult({
    status: "integration_gate_checking",
    previewReady: false,
    receivedAt: Date.now(),
  });
  if (typeof console !== "undefined" && console.info) {
    console.info(
      JSON.stringify({
        action: "implementation_integration_pipeline_requested",
        projectId: pid,
        runnableCount: authoritativeSummary.runnableCount,
        verifiedCount: authoritativeSummary.integrationReadyCount,
        integrationReadyCount: authoritativeSummary.integrationReadyCount,
        totalCount: authoritativeSummary.totalCount,
      }),
    );
  }
  try {
    const pipelineResult = await runProjectIntegrationPrepareOnly({
      projectId: pid,
      projectName: input.projectName.trim() || null,
      implementationCodeTaskPlanV1: input.requirementsState.implementationCodeTaskPlanV1,
      implementationTaskListV1: input.requirementsState.implementationTaskListV1,
      codeTaskExecutionRunsV1: input.requirementsState.codeTaskExecutionRunsV1,
      implementationQuickRunV1: input.requirementsState.implementationQuickRunV1,
      boardSelectionSummary: authoritativeSummary,
      createPullRequest: true,
    });

    if (pipelineResult.orchestrationPatch) {
      input.applyPendingFromOrchestrationPatch(pipelineResult.orchestrationPatch);
    }

    if (!pipelineResult.ok) {
      input.showToast(pipelineResult.message ?? INTEGRATION_PIPELINE_FAILED_USER_MESSAGE);
      if (pipelineResult.orchestrationPatch) {
        await input.persistChatToDb(undefined, pipelineResult.orchestrationPatch, undefined, {
          awaitServer: false,
          force: true,
        });
      }
      return;
    }

    let integrationServerSaved = true;
    if (pipelineResult.orchestrationPatch) {
      const saveResult = await input.persistChatToDb(
        undefined,
        pipelineResult.orchestrationPatch,
        undefined,
        { awaitServer: false, force: true },
      );
      if (saveResult?.serverSaved === false) {
        integrationServerSaved = false;
      }
    }

    const pipelineIntegratedReady =
      pipelineResult.previewReady === true ||
      String(pipelineResult.status ?? "").trim() === "integrated_app_preview_ready";

    input.onClientResult({
      status: pipelineIntegratedReady ? "integrated_app_preview_ready" : (pipelineResult.status ?? ""),
      previewReady: pipelineIntegratedReady ? true : pipelineResult.previewReady === true,
      receivedAt: Date.now(),
    });

    const visibleContinueButton =
      Boolean(String(pipelineResult.nextRequiredStep ?? "").trim()) &&
      pipelineResult.previewReady !== true;

    const pipelineToast = resolveIntegrationPipelineUserToast({
      status: pipelineResult.status,
      previewReady: pipelineResult.previewReady,
      integratedAppPreviewReady: pipelineIntegratedReady,
      message: pipelineResult.message?.trim() || null,
      serverSaved: integrationServerSaved,
      nextRequiredStep: pipelineResult.nextRequiredStep,
      visibleContinueButton,
    });

    if (pipelineToast.reason === "suppressed_legacy_continue") {
      const suppressLog = buildImplementationExecutionLogTimelineEntry({
        action: "implementation_legacy_continue_toast_suppressed",
        orchestrationTraceGroup: "project_integration_pipeline",
        fields: {
          projectId: pid,
          status: pipelineResult.status ?? "",
          previewReady: pipelineResult.previewReady === true,
          integratedAppPreviewReady: pipelineIntegratedReady,
          rawMessage: pipelineResult.message ?? "",
        },
      });
      void input.persistChatToDb(undefined, {
        promptTimeline: appendPromptTimeline(
          parseRequirementsStateJson(input.requirementsStateJsonRef.current).promptTimeline ?? [],
          suppressLog,
        ),
      });
    }

    if (pipelineToast.show && pipelineToast.message) {
      input.showToast(pipelineToast.message);
    }
  } catch (error) {
    input.showToast(toUserSafeIntegrationErrorMessage(error));
  } finally {
    input.setBusy(false);
  }
}
