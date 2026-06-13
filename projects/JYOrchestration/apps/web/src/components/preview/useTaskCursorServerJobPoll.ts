import { useEffect, useRef } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { buildTaskCursorJobOrchestrationSyncFingerprint } from "@/lib/prototype/taskCursorJobStateSync";
import { isServerTaskCursorPolling } from "@/lib/prototype/taskCursorPollingMode";
import { shouldSyncTaskCursorServerJobPollState } from "@/lib/prototype/taskCursorServerJobPollState";
import type { TaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { fetchImplementationRuntime } from "@/lib/runtime/implementationRuntime/implementationRuntimeClient";

export function useTaskCursorServerJobPoll(input: {
  readonly projectId: string;
  readonly requirementsStateJsonRef: React.MutableRefObject<unknown>;
  readonly implementationResetInFlightRef: React.MutableRefObject<boolean>;
  readonly taskCursorExecutionStatus: string | undefined;
  readonly taskCursorCursorRunId: string | undefined;
  readonly setActiveTaskCursorJob: React.Dispatch<React.SetStateAction<TaskCursorJobSummary | null>>;
  readonly enrichOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly applyOrchestrationResult: (input: {
    readonly messages: readonly RequirementsMessage[];
    readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
  readonly chatMessagesRef: React.MutableRefObject<readonly RequirementsMessage[]>;
}): void {
  const lastSyncFingerprintRef = useRef("");

  useEffect(() => {
    lastSyncFingerprintRef.current = "";
  }, [input.taskCursorExecutionStatus, input.taskCursorCursorRunId]);

  useEffect(() => {
    if (!isServerTaskCursorPolling()) return;
    const pid = input.projectId.trim();
    if (!pid) return;
    if (!shouldSyncTaskCursorServerJobPollState(input.requirementsStateJsonRef.current)) {
      input.setActiveTaskCursorJob(null);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      if (input.implementationResetInFlightRef.current) return;
      try {
        if (shouldSyncTaskCursorServerJobPollState(input.requirementsStateJsonRef.current)) {
          void fetchImplementationRuntime(pid, { recover: true });
        }
        const res = await credentialsIncludeFetch(
          `/api/prototype/task-cursor/jobs?projectId=${encodeURIComponent(pid)}`,
        );
        const json = (await res.json()) as {
          success?: boolean;
          activeJob?: TaskCursorJobSummary | null;
          orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
        };
        if (cancelled || !json.success || input.implementationResetInFlightRef.current) return;
        if (!shouldSyncTaskCursorServerJobPollState(input.requirementsStateJsonRef.current)) {
          input.setActiveTaskCursorJob(null);
          return;
        }
        input.setActiveTaskCursorJob(json.activeJob ?? null);
        if (json.orchestrationPatch) {
          const syncFingerprint = buildTaskCursorJobOrchestrationSyncFingerprint(json.orchestrationPatch);
          if (syncFingerprint === lastSyncFingerprintRef.current) return;
          lastSyncFingerprintRef.current = syncFingerprint;
          input.applyOrchestrationResult({
            messages: input.chatMessagesRef.current,
            orchestrationPatch: input.enrichOrchestrationPatch(json.orchestrationPatch),
          });
        }
      } catch {
        // ignore refresh errors
      }
    };
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    input.projectId,
    input.taskCursorExecutionStatus,
    input.taskCursorCursorRunId,
    input.requirementsStateJsonRef,
    input.implementationResetInFlightRef,
    input.setActiveTaskCursorJob,
    input.enrichOrchestrationPatch,
    input.applyOrchestrationResult,
    input.chatMessagesRef,
  ]);
}
