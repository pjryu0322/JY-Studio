"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import type { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import {
  pickIntegrationPipelineClientBoardSummary,
  type ImplementationControlPlaneSnapshotV1,
} from "@/lib/prototype/implementationControlPlaneSnapshot";
import { executeImplementationBoardIntegrationPipeline } from "@/lib/prototype/implementationBoardIntegrationPipelineRun";
import { logIntegrationButtonClicked } from "@/lib/prototype/implementationBoardIntegrationGate";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { resolveFinalWiringReadyForIntegrationGate } from "@/lib/prototype/implementationFinalWiringReadyResolver";
import { summarizeCodeTaskBoardGateFromRequirementsState } from "@/lib/prototype/implementationIntegrationBoardGateSummary";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type ImplementationIntegrationPipelineClientResultV1 = Readonly<{
  readonly status?: string;
  readonly previewReady?: boolean;
  readonly receivedAt?: number;
}>;

/**
 * Controls the integration pipeline client action.
 *
 * Scope:
 * - choose advisory board summary for client request
 * - call integration pipeline API/client
 * - apply returned orchestration patch
 * - refresh runtime state
 * - expose busy/result state
 *
 * Not scope:
 * - board checkbox state
 * - CodeTask execution
 * - GitHub verify
 * - Preview deployment implementation
 * - server authoritative integration gate
 */
export function useImplementationIntegrationPipelineController(input: {
  readonly projectId: string;
  readonly projectName: string;
  readonly boardSelectionBridge: ReturnType<typeof useImplementationBoardSelectionBridge>;
  readonly parentControlPlaneSnapshot: ImplementationControlPlaneSnapshotV1 | null;
  readonly requirementsState: RequirementsStateJson;
  readonly requirementsStateJsonRef: { readonly current: unknown };
  readonly implementationBoardBlockingUserConfirmation: number | null;
  readonly persistChatToDb: (
    chatPatch: undefined,
    orchestrationPatch: Omit<PrototypeExecutionOrchestrationPersistInput, "chat"> | undefined,
    persistSeq: undefined,
    persistOptions?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<{ readonly serverSaved: boolean } | void>;
  readonly applyPendingFromOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput | undefined,
  ) => void;
  readonly showIntegrationPipelineUserNotice: (message: string) => void;
  readonly integrationPipelineClientResultRef: MutableRefObject<ImplementationIntegrationPipelineClientResultV1 | null>;
}): {
  readonly integrationPipelineBusy: boolean;
  readonly integrationPipelineClientResult: ImplementationIntegrationPipelineClientResultV1 | null;
  readonly integrationPipelineClientResultRef: MutableRefObject<ImplementationIntegrationPipelineClientResultV1 | null>;
  readonly runIntegrationPipeline: () => void;
} {
  const [integrationPipelineBusy, setIntegrationPipelineBusy] = useState(false);
  const [integrationPipelineClientResult, setIntegrationPipelineClientResult] =
    useState<ImplementationIntegrationPipelineClientResultV1 | null>(null);

  input.integrationPipelineClientResultRef.current = integrationPipelineClientResult;

  const runIntegrationPipeline = useCallback(() => {
    const pid = input.projectId.trim();
    const bridgeSummary = input.boardSelectionBridge.getBridgeSnapshot().livePanelSummary;
    const boardSelectionSummary = pickIntegrationPipelineClientBoardSummary({
      bridgeSummary,
      parentSnapshot: input.parentControlPlaneSnapshot,
    });
    const mergedState = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
    const authoritativeSummary = pid
      ? summarizeCodeTaskBoardGateFromRequirementsState({
          projectId: pid,
          requirementsState: mergedState,
        })
      : null;
    const fwState = resolveFinalWiringReadyForIntegrationGate({
      requirementsState: mergedState,
      sourceUnitCount: authoritativeSummary?.integrationReadyCount ?? 0,
      projectId: pid || null,
    });

    logIntegrationButtonClicked({
      projectId: pid || null,
      clientSummary: boardSelectionSummary ?? bridgeSummary ?? authoritativeSummary,
      clientFinalWiringReady: fwState.ready,
      skipReason: !pid
        ? "missing_project_id"
        : integrationPipelineBusy
          ? "pipeline_busy"
          : input.implementationBoardBlockingUserConfirmation === null
            ? "blocking_user_confirmation_unresolved"
            : null,
    });

    if (!pid || integrationPipelineBusy) return;
    if (input.implementationBoardBlockingUserConfirmation === null) return;

    void executeImplementationBoardIntegrationPipeline({
      projectId: pid,
      projectName: input.projectName,
      requirementsState: input.requirementsState,
      requirementsStateJsonRef: input.requirementsStateJsonRef,
      implementationBoardBlockingUserConfirmation: input.implementationBoardBlockingUserConfirmation,
      boardSelectionSummary: boardSelectionSummary ?? authoritativeSummary,
      parentControlPlaneSnapshot: input.parentControlPlaneSnapshot,
      persistChatToDb: input.persistChatToDb,
      applyPendingFromOrchestrationPatch: input.applyPendingFromOrchestrationPatch,
      setBusy: setIntegrationPipelineBusy,
      onClientResult: setIntegrationPipelineClientResult,
      showToast: input.showIntegrationPipelineUserNotice,
    });
  }, [
    input.projectId,
    input.projectName,
    input.boardSelectionBridge,
    input.parentControlPlaneSnapshot,
    input.requirementsState,
    input.requirementsStateJsonRef,
    input.implementationBoardBlockingUserConfirmation,
    input.persistChatToDb,
    input.applyPendingFromOrchestrationPatch,
    input.showIntegrationPipelineUserNotice,
    integrationPipelineBusy,
  ]);

  return {
    integrationPipelineBusy,
    integrationPipelineClientResult,
    integrationPipelineClientResultRef: input.integrationPipelineClientResultRef,
    runIntegrationPipeline,
  };
}
