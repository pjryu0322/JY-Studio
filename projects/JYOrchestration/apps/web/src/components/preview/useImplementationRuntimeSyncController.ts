"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { useDbQueuedQuickRunAutoDispatch } from "@/components/preview/useDbQueuedQuickRunAutoDispatch";
import { useImplementationAutoQualityGateTrigger } from "@/components/preview/useImplementationAutoQualityGateTrigger";
import { useImplementationRuntimeDbSync } from "@/components/preview/useImplementationRuntimeDbSync";
import { useRecoverServerQuickRunContinuation } from "@/components/preview/useRecoverServerQuickRunContinuation";
import { useTaskCursorServerJobPoll } from "@/components/preview/useTaskCursorServerJobPoll";
import { resolveCodeTaskRunForAutoQualityGateClient } from "@/lib/prototype/implementationAutoQualityGateClient";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import type { CodeTaskQueueDispatchRef } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import type { ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { readImplementationStageChatMessages } from "@/lib/prototype/implementationStageChatSnapshot";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

/**
 * Controls implementation-stage runtime synchronization wiring.
 *
 * Scope:
 * - wire runtime DB sync hooks
 * - wire queued Quick Run auto-dispatch
 * - wire server Quick Run continuation recovery
 * - wire TaskCursor server job polling
 * - wire auto quality gate trigger
 * - keep runtime sync wiring outside the parent panel hook
 *
 * Not scope:
 * - runtime DB schema
 * - Quick Run execution internals
 * - GitHub verification internals
 * - quality gate business logic
 * - board rendering
 */
export type ImplementationRuntimeSyncControllerInput = Readonly<{
  readonly projectId: string;
  readonly orchestrationAwareRequirementsState: RequirementsStateJson;
  readonly requirementsStateJsonRef: RefObject<unknown>;
  readonly implementationResetInFlightRef: MutableRefObject<boolean>;
  readonly setActiveTaskCursorJob: Dispatch<SetStateAction<TaskCursorJobSummary | null>>;
  readonly dbQueuedQuickRunDispatchRef: MutableRefObject<string | null>;
  readonly pendingQuickRunQueueDispatchRef: MutableRefObject<CodeTaskQueueDispatchRef | null>;
  readonly codeTaskDispatchPreferredTaskIdRef: MutableRefObject<string | null>;
  readonly runImplementationStageActionRef: MutableRefObject<
    (
      actionId: ImplementationStageActionId,
    ) => ImplementationStageActionRunResult | Promise<ImplementationStageActionRunResult>
  >;
  readonly enrichCodeTaskRunOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly applyImplementationOrchestrationResultRef: MutableRefObject<
    (input: {
      readonly messages?: readonly RequirementsMessage[];
      readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
    }) => void
  >;
  readonly appendImplementationExecutionNoticeRef: MutableRefObject<(content: string) => void>;
}>;

export type ImplementationRuntimeSyncControllerValue = Readonly<{
  readonly implementationRuntimeDbBundle: ImplementationRuntimeBundleView | null;
  readonly setImplementationRuntimeDbBundle: Dispatch<
    SetStateAction<ImplementationRuntimeBundleView | null>
  >;
  readonly loadImplementationRuntimeDb: (options?: { readonly recover?: boolean }) => Promise<void>;
  readonly applyImplementationRuntimeFetch: (
    fetched: Awaited<
      ReturnType<
        typeof import("@/lib/runtime/implementationRuntime/implementationRuntimeClient").fetchImplementationRuntime
      >
    >,
  ) => void;
  readonly implementationRuntimePollSuspendedRef: Readonly<{ readonly current: boolean }>;
  readonly dispatchNextQuickRunFromGithubVerify: (next: QuickRunGithubAdvanceDispatch) => void;
}>;

export function useImplementationRuntimeSyncController(
  input: ImplementationRuntimeSyncControllerInput,
): ImplementationRuntimeSyncControllerValue {
  const {
    implementationRuntimeDbBundle,
    setImplementationRuntimeDbBundle,
    loadImplementationRuntimeDb,
    applyImplementationRuntimeFetch,
    implementationRuntimePollSuspendedRef,
  } = useImplementationRuntimeDbSync({
    projectId: input.projectId,
    taskCursorExecutionV1: input.orchestrationAwareRequirementsState.taskCursorExecutionV1,
  });

  const executionSingleChatMessagesRef = useRef<readonly RequirementsMessage[]>(
    readImplementationStageChatMessages(input.requirementsStateJsonRef.current),
  );
  useEffect(() => {
    executionSingleChatMessagesRef.current = readImplementationStageChatMessages(
      input.requirementsStateJsonRef.current,
    );
  }, [input.requirementsStateJsonRef, input.orchestrationAwareRequirementsState]);

  useDbQueuedQuickRunAutoDispatch({
    projectId: input.projectId,
    implementationQuickRunV1: input.orchestrationAwareRequirementsState.implementationQuickRunV1,
    implementationRuntimeDbBundle,
    runtimePollSuspendedRef: implementationRuntimePollSuspendedRef,
    dbQueuedQuickRunDispatchRef: input.dbQueuedQuickRunDispatchRef,
    enrichOrchestrationPatch: input.enrichCodeTaskRunOrchestrationPatch,
    applyOrchestrationPatch: (patch) => {
      input.applyImplementationOrchestrationResultRef.current({
        orchestrationPatch: patch,
      });
    },
    reloadRuntime: () => {
      void loadImplementationRuntimeDb({ recover: false });
    },
  });

  useRecoverServerQuickRunContinuation({
    projectId: input.projectId,
    autoQualityGateStatus:
      input.orchestrationAwareRequirementsState.implementationAutoQualityGateV1?.status,
    autoQualityGateSourceCommitSha:
      input.orchestrationAwareRequirementsState.implementationAutoQualityGateV1?.sourceCommitSha,
    promptTimeline: input.orchestrationAwareRequirementsState.promptTimeline,
    fallbackRunsV1: input.orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
    implementationRuntimeDbBundle,
    requirementsStateJsonRef: input.requirementsStateJsonRef,
    orchestrationAwareRequirementsState: input.orchestrationAwareRequirementsState,
    enrichOrchestrationPatch: input.enrichCodeTaskRunOrchestrationPatch,
    applyOrchestrationPatch: (patch) => {
      input.applyImplementationOrchestrationResultRef.current({
        orchestrationPatch: patch,
      });
    },
  });

  useTaskCursorServerJobPoll({
    projectId: input.projectId,
    requirementsStateJsonRef: input.requirementsStateJsonRef,
    implementationResetInFlightRef: input.implementationResetInFlightRef,
    taskCursorExecutionStatus: input.orchestrationAwareRequirementsState.taskCursorExecutionV1?.status,
    taskCursorCursorRunId: input.orchestrationAwareRequirementsState.taskCursorExecutionV1?.cursorRunId,
    setActiveTaskCursorJob: input.setActiveTaskCursorJob,
    enrichOrchestrationPatch: input.enrichCodeTaskRunOrchestrationPatch,
    applyOrchestrationResult: (orchInput) => {
      input.applyImplementationOrchestrationResultRef.current(orchInput);
    },
    chatMessagesRef: executionSingleChatMessagesRef,
  });

  const appendExecutionNotice = useCallback((message: string) => {
    input.appendImplementationExecutionNoticeRef.current(message);
  }, [input.appendImplementationExecutionNoticeRef]);

  const {
    triggerRef: triggerImplementationAutoQualityGateRef,
    failedTriggerRef: autoQualityGateFailedTriggerRef,
    completedTriggerRef: autoQualityGateCompletedTriggerRef,
  } = useImplementationAutoQualityGateTrigger({
    projectId: input.projectId,
    requirementsStateJsonRef: input.requirementsStateJsonRef,
    enrichOrchestrationPatch: input.enrichCodeTaskRunOrchestrationPatch,
    applyOrchestrationResult: (orchInput) => {
      input.applyImplementationOrchestrationResultRef.current(orchInput);
    },
    chatMessagesRef: executionSingleChatMessagesRef,
    appendExecutionNotice,
  });

  const autoQualityGateEffectSignal = useMemo(() => {
    const execution = parseTaskCursorExecutionV1(
      input.orchestrationAwareRequirementsState.taskCursorExecutionV1,
    );
    const run = resolveCodeTaskRunForAutoQualityGateClient({
      taskCursorExecutionV1: execution,
      codeTaskExecutionRunsV1: input.orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
    });
    const autoGate = input.orchestrationAwareRequirementsState.implementationAutoQualityGateV1;
    const autoGateStatus =
      autoGate && typeof autoGate === "object" && "status" in autoGate
        ? String((autoGate as { status?: string }).status ?? "")
        : "";
    return [
      execution?.taskId ?? "",
      execution?.status ?? "",
      String(execution?.commitSha ?? "").trim(),
      run?.status ?? "",
      autoGateStatus,
      String(
        autoGate && typeof autoGate === "object" && "sourceCommitSha" in autoGate
          ? ((autoGate as { sourceCommitSha?: string }).sourceCommitSha ?? "")
          : "",
      ).trim(),
    ].join("|");
  }, [
    input.orchestrationAwareRequirementsState.taskCursorExecutionV1,
    input.orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
    input.orchestrationAwareRequirementsState.implementationAutoQualityGateV1,
  ]);

  useEffect(() => {
    autoQualityGateFailedTriggerRef.current = null;
    autoQualityGateCompletedTriggerRef.current = null;
  }, [autoQualityGateEffectSignal]);

  useEffect(() => {
    void triggerImplementationAutoQualityGateRef.current();
  }, [autoQualityGateEffectSignal, triggerImplementationAutoQualityGateRef]);

  const dispatchNextQuickRunFromGithubVerify = useCallback(
    (next: QuickRunGithubAdvanceDispatch) => {
      input.pendingQuickRunQueueDispatchRef.current = {
        codeTaskId: next.codeTaskId,
        parentTaskId: next.parentTaskId,
        workItemId: next.workItemId,
      };
      input.codeTaskDispatchPreferredTaskIdRef.current = next.parentTaskId;
      input.runImplementationStageActionRef.current("REQUEST_TASK_CURSOR_EXECUTION");
    },
    [
      input.codeTaskDispatchPreferredTaskIdRef,
      input.pendingQuickRunQueueDispatchRef,
      input.runImplementationStageActionRef,
    ],
  );

  return {
    implementationRuntimeDbBundle,
    setImplementationRuntimeDbBundle,
    loadImplementationRuntimeDb,
    applyImplementationRuntimeFetch,
    implementationRuntimePollSuspendedRef,
    dispatchNextQuickRunFromGithubVerify,
  };
}
