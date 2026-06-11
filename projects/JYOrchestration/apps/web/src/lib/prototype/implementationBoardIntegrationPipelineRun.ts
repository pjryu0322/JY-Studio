import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { evaluateCodeTaskIntegration } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { resolveIntegrationPipelineUserToast } from "@/lib/prototype/implementationIntegrationToastPolicy";
import { INTEGRATION_PREVIEW_PREFLIGHT_CHECKING_USER_MESSAGE } from "@/lib/prototype/integrationPreviewPreflightService";
import { runProjectIntegrationPrepareOnly } from "@/lib/prototype/projectIntegrationPipelineClient";
import { toUserSafeIntegrationErrorMessage } from "@/lib/prototype/implementationIntegrationErrors";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

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
}): Promise<void> {
  const pid = input.projectId.trim();
  if (!pid) {
    input.showToast("프로젝트를 선택해 주세요.");
    return;
  }
  if (input.implementationBoardBlockingUserConfirmation > 0) {
    const canIntegrateFromCompleted = evaluateCodeTaskIntegration({
      codeTaskPlan: input.requirementsState.implementationCodeTaskPlanV1 ?? null,
      taskList: input.requirementsState.implementationTaskListV1 ?? null,
      codeTaskRuns:
        parseCodeTaskExecutionRunsV1(input.requirementsState.codeTaskExecutionRunsV1) ?? [],
      taskCursorExecution: input.requirementsState.taskCursorExecutionV1 ?? null,
      taskCursorExecutionHistory: input.requirementsState.taskCursorExecutionHistoryV1 ?? null,
      autoQualityGate: input.requirementsState.implementationAutoQualityGateV1 ?? null,
    }).canIntegrate;
    if (!canIntegrateFromCompleted) {
      input.showToast("사용자 확인이 필요한 작업이 해소된 뒤 통합을 실행할 수 있습니다.");
      return;
    }
  }

  input.setBusy(true);
  input.showToast(INTEGRATION_PREVIEW_PREFLIGHT_CHECKING_USER_MESSAGE);
  try {
    const pipelineResult = await runProjectIntegrationPrepareOnly({
      projectId: pid,
      projectName: input.projectName.trim() || null,
      implementationCodeTaskPlanV1: input.requirementsState.implementationCodeTaskPlanV1,
      implementationTaskListV1: input.requirementsState.implementationTaskListV1,
      codeTaskExecutionRunsV1: input.requirementsState.codeTaskExecutionRunsV1,
      implementationQuickRunV1: input.requirementsState.implementationQuickRunV1,
      createPullRequest: true,
    });

    if (pipelineResult.orchestrationPatch) {
      input.applyPendingFromOrchestrationPatch(pipelineResult.orchestrationPatch);
    }

    if (!pipelineResult.ok) {
      input.showToast(pipelineResult.message ?? "통합 및 Preview 준비에 실패했습니다.");
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
