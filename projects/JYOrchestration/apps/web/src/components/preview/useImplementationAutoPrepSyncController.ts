"use client";

import { useEffect, useRef } from "react";
import { postImplementationPrepSync } from "@/components/project-spec/apis/quickDesignConfirmApi";
import { pickExecutionStateArtifacts } from "@/lib/prototype/prototypeExecutionEnvSnapshot";
import type { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Controls one-shot implementation prep auto-refine synchronization.
 *
 * Scope:
 * - run one-shot implementation prep sync when requested
 * - avoid running while WIP is active
 * - persist generated implementation prep patch
 * - append implementation task-list messages
 *
 * Not scope:
 * - manual task-list generation
 * - Quick Run execution
 * - Cursor dispatch
 * - board rendering
 */
export type ImplementationAutoPrepSyncControllerInput = Readonly<{
  readonly autoRefineImplementationPrep?: boolean;
  readonly projectId: string;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly orchestrationAwareRequirementsState: RequirementsStateJson;
  readonly requirementsStateJson: unknown;
  readonly executionArtifacts: ReturnType<typeof pickExecutionStateArtifacts>;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly prototypeRunSyncSnapshot: ReturnType<typeof deriveImplementationPrototypeRunSyncSnapshot>;
  readonly persistChatToDb: (
    chat?: unknown,
    orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput,
    message?: unknown,
    options?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<unknown> | void;
  readonly appendImplementationTaskListAiMessage: (message: RequirementsMessage) => void;
}>;

export function useImplementationAutoPrepSyncController(
  input: ImplementationAutoPrepSyncControllerInput,
): void {
  const autoRefineOnceRef = useRef(false);

  useEffect(() => {
    if (autoRefineOnceRef.current) return;
    if (input.autoRefineImplementationPrep !== true) return;
    autoRefineOnceRef.current = true;

    const wip = input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1;
    const wipStatus = String(wip?.status ?? "").trim();
    const activeStatuses = new Set([
      "requested",
      "drafting",
      "refactoring",
      "wip_committed",
      "developer_reviewing",
      "refactor_requested",
      "wip_updated",
    ]);
    if (wip && activeStatuses.has(wipStatus)) {
      return;
    }

    const pid = input.projectId.trim();
    const seed = input.parsedRequirementsState.implementationSeedV1;
    void (async () => {
      const { res, json } = await postImplementationPrepSync(pid, {
        seed,
        existingTaskList: input.parsedRequirementsState.implementationTaskListV1,
        existingCodeTaskPlan: input.parsedRequirementsState.implementationCodeTaskPlanV1,
        existingExecutionState: input.parsedRequirementsState.implementationTaskExecutionStateV1,
        existingCursorWorkItems: input.parsedRequirementsState.cursorWorkItemsV1,
        existingPreflightSummary: input.parsedRequirementsState.implementationWorkItemPreflightSummaryV1,
        existingQualityGate: input.parsedRequirementsState.implementationCodeTaskQualityGateV1,
        priorTimeline: input.parsedRequirementsState.promptTimeline,
        projectArtifacts: input.executionArtifacts.projectArtifacts,
        artifactOrchestrationV1: input.parsedRequirementsState.artifactOrchestrationV1,
        envOk: input.envOk,
        designOk: input.designOk,
        previewReady: input.prototypeRunSyncSnapshot.previewReady,
        forceRefresh: true,
        forceLlm: true,
      });
      const result = json.data;
      if (!res.ok || !json.success || !result?.ok) {
        return;
      }
      void input.persistChatToDb(
        resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson),
        result.patch,
      );
      for (const message of result.messages) {
        input.appendImplementationTaskListAiMessage(message);
      }
    })();
  }, [
    input.autoRefineImplementationPrep,
    input.orchestrationAwareRequirementsState.codeAgentWipExecutionV1,
    input.projectId,
    input.parsedRequirementsState,
    input.executionArtifacts,
    input.envOk,
    input.designOk,
    input.prototypeRunSyncSnapshot.previewReady,
    input.persistChatToDb,
    input.requirementsStateJson,
    input.appendImplementationTaskListAiMessage,
  ]);
}
