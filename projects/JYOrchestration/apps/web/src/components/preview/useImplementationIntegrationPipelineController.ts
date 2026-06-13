"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import type { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import {
  pickIntegrationPipelineClientBoardSummary,
  type ImplementationControlPlaneSnapshotV1,
} from "@/lib/prototype/implementationControlPlaneSnapshot";
import { executeImplementationBoardIntegrationPipeline } from "@/lib/prototype/implementationBoardIntegrationPipelineRun";
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
    if (!pid || integrationPipelineBusy) return;
    if (input.implementationBoardBlockingUserConfirmation === null) return;

    // Client boardSelectionSummary is advisory only.
    // Server route recomputes serverBoardGate and uses it as the authoritative integration gate.
    // Prefer bridge live summary because parent snapshot can lag behind the board panel.
    const boardSelectionSummary = pickIntegrationPipelineClientBoardSummary({
      bridgeSummary: input.boardSelectionBridge.getBridgeSnapshot().livePanelSummary,
      parentSnapshot: input.parentControlPlaneSnapshot,
    });
    if (!boardSelectionSummary) return;

    void executeImplementationBoardIntegrationPipeline({
      projectId: pid,
      projectName: input.projectName,
      requirementsState: input.requirementsState,
      requirementsStateJsonRef: input.requirementsStateJsonRef,
      implementationBoardBlockingUserConfirmation: input.implementationBoardBlockingUserConfirmation,
      boardSelectionSummary: boardSelectionSummary,
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
