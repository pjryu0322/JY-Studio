"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import type { CodeTaskManualGithubRecheckPayloadV1 } from "@/lib/prototype/codeTaskManualGithubRecheckPayload";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import { parseImplementationExecutionUnitsStateV1 } from "@/lib/prototype/implementationExecutionUnitStore";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import {
  runCodeTaskGithubVerifyRecheck,
  runQuickRunStuckGithubVerifyRecovery,
} from "@/lib/prototype/implementationQuickRunGithubVerifyRecovery";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { parseRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { fetchImplementationRuntime } from "@/lib/runtime/implementationRuntime/implementationRuntimeClient";
import { resolveEffectiveCodeTaskExecutionQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

/**
 * Controls implementation-stage GitHub verification client actions.
 *
 * Scope:
 * - recover stuck Quick Run GitHub verification
 * - trigger manual GitHub verify retry
 * - recheck a single CodeTask GitHub verification
 * - refresh implementation runtime after verify actions
 * - expose busy state for manual CodeTask recheck
 *
 * Not scope:
 * - CodeTask execution dispatch
 * - Integration pipeline
 * - Preview deployment
 * - Quality gate execution
 * - server-side GitHub verification implementation
 */
export type ImplementationGithubVerifyControllerInput = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJsonRef: MutableRefObject<unknown>;
  readonly effectiveCodeTaskExecutionQueueV1: ReturnType<typeof resolveEffectiveCodeTaskExecutionQueue>;
  readonly implementationRuntimeDbBundle: ImplementationRuntimeBundleView | null;
  readonly executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  readonly implementationStageBoardInput: Readonly<{ readonly taskList: ImplementationTaskListV1 }> | null;
  readonly orchestrationAwareRequirementsState: RequirementsStateJson;
  readonly quickRunStuckGithubVerifyRef: MutableRefObject<string | null>;
  readonly quickRunCodeTaskContinuationRef: MutableRefObject<string | null>;
  readonly enrichCodeTaskRunOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly applyImplementationOrchestrationResult: (input: {
    readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
  readonly dispatchNextQuickRunFromGithubVerify: (next: QuickRunGithubAdvanceDispatch) => void;
  readonly appendUserNotice: (message: string) => void;
  readonly appendImplementationExecutionNotice: (message: string) => void;
  readonly applyImplementationRuntimeFetch: (
    fetched: Awaited<ReturnType<typeof fetchImplementationRuntime>>,
  ) => void;
  readonly loadImplementationRuntimeDb: (options?: { readonly recover?: boolean }) => Promise<void>;
  readonly runFallbackVerifyAction: () => void;
}>;

export type ImplementationGithubVerifyControllerValue = Readonly<{
  readonly githubRecheckBusyCodeTaskId: string | null;
  readonly recoverQuickRunStuckGithubVerify: (options?: { readonly force?: boolean }) => Promise<boolean>;
  readonly handleManualGithubVerifyRetry: () => Promise<void>;
  readonly handleRecheckCodeTaskGithubVerify: (input: {
    readonly codeTaskId: string;
    readonly rowPayload?: CodeTaskManualGithubRecheckPayloadV1 | null;
  }) => Promise<void>;
}>;

export function useImplementationGithubVerifyController(
  input: ImplementationGithubVerifyControllerInput,
): ImplementationGithubVerifyControllerValue {
  const [githubRecheckBusyCodeTaskId, setGithubRecheckBusyCodeTaskId] = useState<string | null>(
    null,
  );

  const recoverQuickRunStuckGithubVerify = useCallback(
    async (options?: { readonly force?: boolean }) => {
      const pid = input.projectId.trim();
      if (!pid) return false;
      const state = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
      return runQuickRunStuckGithubVerifyRecovery({
        projectId: pid,
        state,
        effectiveQueue: input.effectiveCodeTaskExecutionQueueV1,
        dbBundle: input.implementationRuntimeDbBundle,
        stuckVerifyDedupeRef: input.quickRunStuckGithubVerifyRef,
        continuationTriggerRef: input.quickRunCodeTaskContinuationRef,
        enrichPatch: input.enrichCodeTaskRunOrchestrationPatch,
        applyOrchestrationPatch: (patch) => {
          input.applyImplementationOrchestrationResult({ orchestrationPatch: patch });
        },
        onNextQuickRunDispatch: input.dispatchNextQuickRunFromGithubVerify,
        showToast: input.appendUserNotice,
        onFailureNotice: (message) => input.appendImplementationExecutionNotice(message),
        refreshRuntime: async () => {
          const fetched = await fetchImplementationRuntime(pid);
          if (fetched.success) input.applyImplementationRuntimeFetch(fetched);
        },
        force: options?.force === true,
      });
    },
    [
      input.projectId,
      input.requirementsStateJsonRef,
      input.effectiveCodeTaskExecutionQueueV1,
      input.implementationRuntimeDbBundle,
      input.quickRunStuckGithubVerifyRef,
      input.quickRunCodeTaskContinuationRef,
      input.enrichCodeTaskRunOrchestrationPatch,
      input.applyImplementationOrchestrationResult,
      input.dispatchNextQuickRunFromGithubVerify,
      input.appendUserNotice,
      input.appendImplementationExecutionNotice,
      input.applyImplementationRuntimeFetch,
    ],
  );

  const handleManualGithubVerifyRetry = useCallback(async () => {
    input.quickRunStuckGithubVerifyRef.current = null;
    const ran = await recoverQuickRunStuckGithubVerify({ force: true });
    await input.loadImplementationRuntimeDb({ recover: true });
    if (!ran) {
      input.runFallbackVerifyAction();
    }
  }, [
    input.quickRunStuckGithubVerifyRef,
    input.loadImplementationRuntimeDb,
    input.runFallbackVerifyAction,
    recoverQuickRunStuckGithubVerify,
  ]);

  const handleRecheckCodeTaskGithubVerify = useCallback(
    async (recheckInput: {
      readonly codeTaskId: string;
      readonly rowPayload?: CodeTaskManualGithubRecheckPayloadV1 | null;
    }) => {
      const pid = input.projectId.trim();
      const id = recheckInput.codeTaskId.trim();
      if (!pid || !id || githubRecheckBusyCodeTaskId === id) return;
      setGithubRecheckBusyCodeTaskId(id);
      try {
        const state = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
        await runCodeTaskGithubVerifyRecheck({
          projectId: pid,
          codeTaskId: id,
          state,
          dbBundle: input.implementationRuntimeDbBundle,
          executionSetup: input.executionSetupRow ?? undefined,
          taskList: input.implementationStageBoardInput?.taskList,
          executionUnits:
            parseImplementationExecutionUnitsStateV1(
              input.orchestrationAwareRequirementsState.implementationExecutionUnitsV1,
            )?.units ?? undefined,
          rowPayload: recheckInput.rowPayload ?? undefined,
          continuationTriggerRef: input.quickRunCodeTaskContinuationRef,
          enrichPatch: input.enrichCodeTaskRunOrchestrationPatch,
          applyOrchestrationPatch: (patch) => {
            input.applyImplementationOrchestrationResult({ orchestrationPatch: patch });
          },
          onNextQuickRunDispatch: input.dispatchNextQuickRunFromGithubVerify,
          showToast: input.appendUserNotice,
          onFailureNotice: (message) => input.appendImplementationExecutionNotice(message),
          refreshRuntime: async () => {
            const fetched = await fetchImplementationRuntime(pid);
            if (fetched.success) input.applyImplementationRuntimeFetch(fetched);
          },
        });
        await input.loadImplementationRuntimeDb({ recover: true });
      } finally {
        setGithubRecheckBusyCodeTaskId((current) => (current === id ? null : current));
      }
    },
    [
      input.projectId,
      input.requirementsStateJsonRef,
      input.implementationRuntimeDbBundle,
      input.executionSetupRow,
      input.implementationStageBoardInput?.taskList,
      input.orchestrationAwareRequirementsState.implementationExecutionUnitsV1,
      input.quickRunCodeTaskContinuationRef,
      input.enrichCodeTaskRunOrchestrationPatch,
      input.applyImplementationOrchestrationResult,
      input.dispatchNextQuickRunFromGithubVerify,
      input.appendUserNotice,
      input.appendImplementationExecutionNotice,
      input.applyImplementationRuntimeFetch,
      input.loadImplementationRuntimeDb,
      githubRecheckBusyCodeTaskId,
    ],
  );

  return {
    githubRecheckBusyCodeTaskId,
    recoverQuickRunStuckGithubVerify,
    handleManualGithubVerifyRetry,
    handleRecheckCodeTaskGithubVerify,
  };
}
