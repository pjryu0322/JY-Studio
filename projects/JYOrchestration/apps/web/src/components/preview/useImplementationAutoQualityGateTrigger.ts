import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildImplementationAutoQualityGateTriggerKey,
  runImplementationAutoQualityGateClient,
  shouldTriggerImplementationAutoQualityGateClient,
} from "@/lib/prototype/implementationAutoQualityGateClient";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export function useImplementationAutoQualityGateTrigger(input: {
  readonly projectId: string;
  readonly requirementsStateJsonRef: { readonly current: unknown };
  readonly enrichOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly applyOrchestrationResult: (orch: {
    readonly messages?: readonly RequirementsMessage[];
    readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
  readonly chatMessagesRef: { readonly current: readonly RequirementsMessage[] };
  readonly appendExecutionNotice: (message: string) => void;
}): Readonly<{
  readonly trigger: () => Promise<void>;
  readonly triggerRef: MutableRefObject<() => Promise<void>>;
  readonly inFlightRef: MutableRefObject<string | null>;
  readonly failedTriggerRef: MutableRefObject<string | null>;
  readonly completedTriggerRef: MutableRefObject<string | null>;
}> {
  const inFlightRef = useRef<string | null>(null);
  const failedTriggerRef = useRef<string | null>(null);
  const completedTriggerRef = useRef<string | null>(null);

  const trigger = useCallback(async () => {
    const pid = input.projectId.trim();
    if (!pid) return;
    const freshState = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
    const execution = parseTaskCursorExecutionV1(freshState.taskCursorExecutionV1);
    if (!execution) return;
    const clientInput = {
      projectId: pid,
      taskCursorExecutionV1: execution,
      implementationTaskListV1: freshState.implementationTaskListV1,
      implementationTaskExecutionStateV1: freshState.implementationTaskExecutionStateV1,
      implementationQualityGateResultsV1: freshState.implementationQualityGateResultsV1,
      implementationAutoQualityGateV1: freshState.implementationAutoQualityGateV1,
      implementationAutoQualityGateHistoryV1: freshState.implementationAutoQualityGateHistoryV1,
      cursorWorkItemsV1: freshState.cursorWorkItemsV1 ?? [],
      promptTimeline: freshState.promptTimeline,
      codeTaskExecutionRunsV1: freshState.codeTaskExecutionRunsV1,
    };
    if (!shouldTriggerImplementationAutoQualityGateClient(clientInput)) {
      completedTriggerRef.current = buildImplementationAutoQualityGateTriggerKey(execution);
      return;
    }
    const triggerKey = buildImplementationAutoQualityGateTriggerKey(execution);
    if (completedTriggerRef.current === triggerKey) return;
    if (failedTriggerRef.current === triggerKey) return;
    if (inFlightRef.current === triggerKey) return;
    inFlightRef.current = triggerKey;
    try {
      const outcome = await runImplementationAutoQualityGateClient(clientInput);
      if (!outcome.ok) {
        failedTriggerRef.current = triggerKey;
        if (outcome.message) {
          input.appendExecutionNotice(outcome.message);
        }
        return;
      }
      failedTriggerRef.current = null;
      if (outcome.orchestrationPatch) {
        input.applyOrchestrationResult({
          orchestrationPatch: input.enrichOrchestrationPatch(outcome.orchestrationPatch),
        });
      }
      const afterPatch = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
      const afterExecution = parseTaskCursorExecutionV1(afterPatch.taskCursorExecutionV1);
      const stillNeedsGate =
        afterExecution &&
        shouldTriggerImplementationAutoQualityGateClient({
          projectId: pid,
          taskCursorExecutionV1: afterExecution,
          implementationAutoQualityGateV1: afterPatch.implementationAutoQualityGateV1,
          codeTaskExecutionRunsV1: afterPatch.codeTaskExecutionRunsV1,
        });
      if (outcome.status === "skipped" || !stillNeedsGate) {
        completedTriggerRef.current = triggerKey;
      }
      if (outcome.message) {
        input.appendExecutionNotice(outcome.message);
      }
    } finally {
      if (inFlightRef.current === triggerKey) {
        inFlightRef.current = null;
      }
    }
  }, [
    input.projectId,
    input.requirementsStateJsonRef,
    input.enrichOrchestrationPatch,
    input.applyOrchestrationResult,
    input.chatMessagesRef,
    input.appendExecutionNotice,
  ]);

  const triggerRef = useRef(trigger);
  useEffect(() => {
    triggerRef.current = trigger;
  }, [trigger]);

  return {
    trigger,
    triggerRef,
    inFlightRef,
    failedTriggerRef,
    completedTriggerRef,
  };
}
