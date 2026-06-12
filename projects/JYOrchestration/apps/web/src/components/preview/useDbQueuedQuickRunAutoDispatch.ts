import { useEffect, useRef } from "react";
import { postDbQueuedQuickRunAutoDispatch } from "@/lib/prototype/implementationDbQueuedQuickRunContinuation";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";

export function useDbQueuedQuickRunAutoDispatch(input: {
  readonly projectId: string;
  readonly implementationQuickRunV1: unknown;
  readonly implementationRuntimeDbBundle: ImplementationRuntimeBundleView | null;
  readonly runtimePollSuspendedRef: Readonly<{ readonly current: boolean }>;
  readonly dbQueuedQuickRunDispatchRef: React.MutableRefObject<string | null>;
  readonly enrichOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly applyOrchestrationPatch: (patch: PrototypeExecutionOrchestrationPersistInput) => void;
  readonly reloadRuntime: () => void;
}): void {
  const enrichRef = useRef(input.enrichOrchestrationPatch);
  enrichRef.current = input.enrichOrchestrationPatch;
  const applyRef = useRef(input.applyOrchestrationPatch);
  applyRef.current = input.applyOrchestrationPatch;

  useEffect(() => {
    const pid = input.projectId.trim();
    if (!pid || input.runtimePollSuspendedRef.current) return;

    const quickRun = parseImplementationQuickRunV1(input.implementationQuickRunV1);
    if (quickRun?.status !== "running") {
      input.dbQueuedQuickRunDispatchRef.current = null;
      return;
    }

    const job = input.implementationRuntimeDbBundle?.job;
    const dbRun = input.implementationRuntimeDbBundle?.currentRun;
    if (!job || job.status !== "running" || dbRun?.runtimeState !== "queued") {
      if (dbRun?.runtimeState !== "queued") {
        input.dbQueuedQuickRunDispatchRef.current = null;
      }
      return;
    }

    const dedupeKey = `${dbRun.id}:${dbRun.codeTaskId}`;
    if (input.dbQueuedQuickRunDispatchRef.current === dedupeKey) {
      return;
    }
    input.dbQueuedQuickRunDispatchRef.current = dedupeKey;

    void (async () => {
      try {
        const result = await postDbQueuedQuickRunAutoDispatch({ projectId: pid });
        if (result.orchestrationPatch) {
          applyRef.current(
            enrichRef.current(result.orchestrationPatch as PrototypeExecutionOrchestrationPersistInput),
          );
        }
        if (result.dispatchOk || result.dispatchOutcome === "dispatched") {
          input.reloadRuntime();
        } else if (result.dispatchReason && result.dispatchOutcome !== "skipped") {
          input.dbQueuedQuickRunDispatchRef.current = null;
        }
      } catch {
        input.dbQueuedQuickRunDispatchRef.current = null;
      }
    })();
  }, [
    input.projectId,
    input.implementationQuickRunV1,
    input.implementationRuntimeDbBundle?.currentRun?.codeTaskId,
    input.implementationRuntimeDbBundle?.currentRun?.id,
    input.implementationRuntimeDbBundle?.currentRun?.runtimeState,
    input.implementationRuntimeDbBundle?.job?.status,
    input.reloadRuntime,
    input.runtimePollSuspendedRef,
    input.dbQueuedQuickRunDispatchRef,
  ]);
}
