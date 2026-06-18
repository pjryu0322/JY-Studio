"use client";

import { useCallback, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import type { useImplementationBoardSelectionBridge } from "@/components/preview/useImplementationBoardSelectionBridge";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { resolveOrchestrationAwareRequirementsState } from "@/lib/prototype/implementationOrchestrationAwareRequirementsState";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import { buildImplementationDatabaseRequiredRunResult } from "@/lib/prototype/implementationPlanningDatabaseExecutionGuard";
import {
  buildImplementationQuickRunQueueItems,
  buildImplementationQuickRunRequirementsPrepPersistPatch,
  buildQuickRunOrchestrationAfterJobStart,
  buildRepairTimelineEntries,
  continueImplementationQuickRunAfterStart,
  evaluateImplementationQuickRunPrepAndSelection,
  postImplementationQuickRunStartJob,
  prepareRequirementsStateForImplementationQuickRun,
} from "@/lib/prototype/implementationQuickRunStartService";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

/**
 * Controls implementation-stage Quick Run client actions.
 *
 * Scope:
 * - evaluate Quick Run preparation and selected CodeTasks
 * - repair missing quick-run prerequisites
 * - start DB runtime job
 * - persist Quick Run orchestration patch
 * - dispatch first CodeTask execution after job start
 * - expose startImplementationQuickRun for UI/action routing
 *
 * Not scope:
 * - GitHub verification/recheck
 * - Integration pipeline
 * - Preview deployment
 * - Quality gate execution
 * - board rendering
 */
export type ImplementationQuickRunControllerInput = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly requirementsStateJsonRef: MutableRefObject<unknown>;
  readonly orchestrationAwareRequirementsStateRef: RefObject<
    ReturnType<typeof resolveOrchestrationAwareRequirementsState>
  >;
  readonly boardSelectionBridge: ReturnType<typeof useImplementationBoardSelectionBridge>;
  readonly executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  readonly quickRunStuckGithubVerifyRef: MutableRefObject<string | null>;
  readonly quickRunCodeTaskContinuationRef: MutableRefObject<string | null>;
  readonly dbQueuedQuickRunDispatchRef: MutableRefObject<string | null>;
  readonly codeTaskDispatchPreferredTaskIdRef: MutableRefObject<string | null>;
  readonly setImplementationRuntimeDbBundle: Dispatch<
    SetStateAction<ImplementationRuntimeBundleView | null>
  >;
  readonly loadImplementationRuntimeDb: (options?: { readonly recover?: boolean }) => Promise<void>;
  readonly recordQuickRunClientEvent: (input: {
    readonly phase: string;
    readonly detail: string;
    readonly selectedCount?: number;
  }) => void;
  readonly applyPendingFromOrchestrationPatchRef: MutableRefObject<
    (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => void
  >;
  readonly applyImplementationOrchestrationResult: (
    input: { readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput },
    options?: { readonly persist?: boolean; readonly forcePersist?: boolean },
  ) => void;
  readonly enrichCodeTaskRunOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly persistChatToDb: (
    chatPatch: ReturnType<typeof resolvePrototypeExecutionSingleChatFromState> | undefined,
    orchestrationPatch: Omit<PrototypeExecutionOrchestrationPersistInput, "chat"> | undefined,
    persistSeq: undefined,
    persistOptions?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<{ readonly serverSaved: boolean } | void>;
  readonly appendUserNotice: (message: string) => void;
}>;

export type ImplementationQuickRunControllerValue = Readonly<{
  readonly startImplementationQuickRun: (options?: {
    readonly selectedCodeTaskIds?: readonly string[];
  }) => Promise<ImplementationStageActionRunResult>;
}>;

type OrchestrationAwareRequirementsState = ReturnType<typeof resolveOrchestrationAwareRequirementsState>;

/** Quick Run prep persist (copy-prompt 등 client-side prep). 실행 본문은 `startImplementationQuickRun`. */
export async function persistImplementationQuickRunRequirementsPrep(input: {
  readonly projectId: string;
  readonly requirementsState: OrchestrationAwareRequirementsState;
  readonly applyPendingFromOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput | undefined,
  ) => void;
  readonly persistChatToDb: ImplementationQuickRunControllerInput["persistChatToDb"];
  readonly nowIso?: string;
  readonly persistAwaitServer?: boolean;
}): Promise<OrchestrationAwareRequirementsState> {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const prepared = prepareRequirementsStateForImplementationQuickRun({
    projectId: pid,
    requirementsState: input.requirementsState,
    nowIso,
  });
  const prepPatch = buildImplementationQuickRunRequirementsPrepPersistPatch({ prepared });
  if (Object.keys(prepPatch).length) {
    input.applyPendingFromOrchestrationPatch(prepPatch);
    await input.persistChatToDb(undefined, prepPatch, undefined, {
      awaitServer: input.persistAwaitServer ?? false,
      force: true,
    });
  }
  return prepared.requirementsState;
}

export function useImplementationQuickRunController(
  input: ImplementationQuickRunControllerInput,
): ImplementationQuickRunControllerValue {
  const startImplementationQuickRun = useCallback(
    async (options?: {
      readonly selectedCodeTaskIds?: readonly string[];
    }): Promise<ImplementationStageActionRunResult> => {
      const pid = input.projectId.trim();
      if (!pid) return { outcome: "blocked", message: "프로젝트 ID가 없습니다." };
      const imp = input.orchestrationAwareRequirementsStateRef.current;
      const bridge = input.boardSelectionBridge.getBridgeSnapshot();
      const prepEval = evaluateImplementationQuickRunPrepAndSelection({
        projectId: pid,
        requirementsState: imp,
        selectedCodeTaskIdsOverride: options?.selectedCodeTaskIds,
        bridge,
      });
      if (!prepEval.ok) {
        if (prepEval.kind === "database_required") {
          input.recordQuickRunClientEvent({
            phase: "quick_run_blocked_database_required",
            detail: prepEval.blockReason,
            selectedCount: 0,
          });
          const blockedTimeline = appendPromptTimeline(imp.promptTimeline, prepEval.timelineEntry);
          input.applyPendingFromOrchestrationPatchRef.current({ promptTimeline: blockedTimeline });
          void input.persistChatToDb(undefined, { promptTimeline: blockedTimeline }, undefined, {
            force: true,
          });
          input.appendUserNotice(prepEval.message);
          return buildImplementationDatabaseRequiredRunResult({
            blocked: true,
            blockReason: prepEval.blockReason,
            message: prepEval.message,
            actionLabel: prepEval.actionLabel,
          });
        }
        if (prepEval.kind === "mock_id_blocked") {
          input.recordQuickRunClientEvent({
            phase: "quick_run_selected_mock_id_blocked",
            detail: prepEval.message,
            selectedCount: 0,
          });
          const blockedTimeline = appendPromptTimeline(imp.promptTimeline, prepEval.timelineEntry);
          input.applyPendingFromOrchestrationPatchRef.current({ promptTimeline: blockedTimeline });
          void input.persistChatToDb(undefined, { promptTimeline: blockedTimeline }, undefined, {
            force: true,
          });
          return { outcome: "blocked", message: prepEval.message };
        }
        input.recordQuickRunClientEvent({
          phase: prepEval.phase,
          detail: prepEval.message,
          selectedCount: prepEval.selectedCount,
        });
        return { outcome: "blocked", message: prepEval.message };
      }
      if (prepEval.repairs.length) {
        const nowIso = new Date().toISOString();
        const repairEntries = buildRepairTimelineEntries({
          projectId: pid,
          repairs: prepEval.repairs,
          nowIso,
        });
        let repairTimeline = imp.promptTimeline;
        for (const entry of repairEntries) {
          repairTimeline = appendPromptTimeline(repairTimeline, entry);
        }
        input.applyPendingFromOrchestrationPatchRef.current({ promptTimeline: repairTimeline });
        void input.persistChatToDb(undefined, { promptTimeline: repairTimeline }, undefined, {
          force: true,
        });
      }
      const jobSelectedCodeTaskIds = prepEval.selectedRunnableCodeTaskIds;
      input.recordQuickRunClientEvent({
        phase: "start_implementation_quick_run",
        detail: jobSelectedCodeTaskIds.length
          ? `selected=${jobSelectedCodeTaskIds.join(",")}`
          : "selected=none",
        selectedCount: jobSelectedCodeTaskIds.length,
      });
      input.quickRunStuckGithubVerifyRef.current = null;
      input.quickRunCodeTaskContinuationRef.current = null;
      input.dbQueuedQuickRunDispatchRef.current = null;
      const nowIso = new Date().toISOString();
      const impForQuickRun = await persistImplementationQuickRunRequirementsPrep({
        projectId: pid,
        requirementsState: imp,
        applyPendingFromOrchestrationPatch: (patch) => {
          input.applyPendingFromOrchestrationPatchRef.current(patch);
        },
        persistChatToDb: input.persistChatToDb,
        nowIso,
        persistAwaitServer: true,
      });
      const queueItems = buildImplementationQuickRunQueueItems({
        selectedCodeTaskIds: jobSelectedCodeTaskIds,
        requirementsState: impForQuickRun,
      });
      const startJobRes = await postImplementationQuickRunStartJob({
        projectId: pid,
        selectedCodeTaskIds: jobSelectedCodeTaskIds,
        queueItems,
      });
      if (!startJobRes.success) {
        const message = startJobRes.message ?? "DB Runtime Job 시작에 실패했습니다.";
        input.recordQuickRunClientEvent({
          phase: "start_job_failed",
          detail: message,
          selectedCount: jobSelectedCodeTaskIds.length,
        });
        return { outcome: "blocked", message };
      }
      if (startJobRes.bundle) {
        input.setImplementationRuntimeDbBundle(startJobRes.bundle);
      }

      const runtimeBundle = startJobRes.bundle ?? null;
      const firstCodeTaskId =
        runtimeBundle?.job?.currentCodeTaskId?.trim() ?? jobSelectedCodeTaskIds[0]?.trim() ?? "";
      if (!runtimeBundle?.job?.id || !firstCodeTaskId) {
        const message =
          "DB Runtime Job을 시작하지 못했습니다. 마이그레이션 적용 후 다시 시도하거나 Runtime을 새로고침하세요.";
        return { outcome: "blocked", message };
      }
      const orchestration = buildQuickRunOrchestrationAfterJobStart({
        projectId: pid,
        jobSelectedCodeTaskIds,
        firstCodeTaskId,
        requirementsState: impForQuickRun,
        requirementsStateJsonRaw: input.requirementsStateJsonRef.current,
        executionSetup: input.executionSetupRow,
        nowIso,
      });
      if ("ok" in orchestration) {
        return { outcome: "blocked", message: orchestration.message };
      }
      const orch = orchestration;
      const { quickRun, codeTaskExecutionRunsV1, runtimeUiSnapshotPatch, dispatchTarget } = orch;
      input.applyImplementationOrchestrationResult(
        {
          orchestrationPatch: {
            implementationQuickRunV1: quickRun,
            codeTaskExecutionRunsV1,
            implementationRuntimeUiSnapshotV1: runtimeUiSnapshotPatch,
          },
        },
        { persist: false },
      );
      input.codeTaskDispatchPreferredTaskIdRef.current = dispatchTarget.parentTaskId;
      const dbRunId = runtimeBundle.currentRun?.id?.trim() ?? "";
      if (dbRunId) {
        input.dbQueuedQuickRunDispatchRef.current = `${dbRunId}:${dispatchTarget.codeTask.codeTaskId}`;
      }
      void continueImplementationQuickRunAfterStart({
        projectId: pid,
        imp,
        startJobRes,
        orchestration: orch,
        nowIso,
        enrichOrchestrationPatch: input.enrichCodeTaskRunOrchestrationPatch,
        onDispatchPatch: (patch) => {
          input.applyImplementationOrchestrationResult({
            orchestrationPatch: patch,
          });
        },
        persistAfterStart: async (patch) => {
          await input.persistChatToDb(
            resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson),
            patch,
            undefined,
            { awaitServer: true, force: true },
          );
        },
        persistDispatchTimeline: (entry) => {
          void input.persistChatToDb(
            resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson),
            {
              promptTimeline: appendPromptTimeline(imp.promptTimeline, entry),
            },
          );
        },
        onRuntimeBundle: input.setImplementationRuntimeDbBundle,
        reloadRuntime: () => {
          void input.loadImplementationRuntimeDb({ recover: false });
        },
        clearDbQueuedDispatchKey: () => {
          input.dbQueuedQuickRunDispatchRef.current = null;
        },
        showToast: input.appendUserNotice,
      });
      return { outcome: "executed" as const };
    },
    [
      input.projectId,
      input.orchestrationAwareRequirementsStateRef,
      input.boardSelectionBridge,
      input.requirementsStateJson,
      input.requirementsStateJsonRef,
      input.executionSetupRow,
      input.quickRunStuckGithubVerifyRef,
      input.quickRunCodeTaskContinuationRef,
      input.dbQueuedQuickRunDispatchRef,
      input.codeTaskDispatchPreferredTaskIdRef,
      input.recordQuickRunClientEvent,
      input.applyPendingFromOrchestrationPatchRef,
      input.applyImplementationOrchestrationResult,
      input.enrichCodeTaskRunOrchestrationPatch,
      input.persistChatToDb,
      input.setImplementationRuntimeDbBundle,
      input.loadImplementationRuntimeDb,
      input.appendUserNotice,
    ],
  );

  return { startImplementationQuickRun };
}
