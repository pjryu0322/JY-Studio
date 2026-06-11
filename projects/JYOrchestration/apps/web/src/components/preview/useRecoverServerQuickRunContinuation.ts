import { useCallback, useEffect } from "react";
import { formatQuickRunContinuationReason } from "@/lib/prototype/implementationQuickRun";
import {
  recoverServerQuickRunContinuation,
  shouldRecoverServerQuickRunContinuation,
} from "@/lib/prototype/implementationRecoverServerQuickRunContinuation";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export function useRecoverServerQuickRunContinuation(input: {
  readonly projectId: string;
  readonly autoQualityGateStatus: string | null | undefined;
  readonly autoQualityGateSourceCommitSha: string | null | undefined;
  readonly promptTimeline: readonly unknown[] | null | undefined;
  readonly fallbackRunsV1: unknown;
  readonly implementationRuntimeDbBundle: ImplementationRuntimeBundleView | null;
  readonly requirementsStateJsonRef: React.MutableRefObject<unknown>;
  readonly orchestrationAwareRequirementsState: RequirementsStateJson;
  readonly enrichOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly applyOrchestrationPatch: (patch: PrototypeExecutionOrchestrationPersistInput) => void;
  readonly showToast: (message: string) => void;
}): void {
  const recoverIfNeeded = useCallback(async () => {
    const pid = input.projectId.trim();
    if (!pid) return;

    const state = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
    if (
      !shouldRecoverServerQuickRunContinuation({
        requirementsState: state,
        promptTimeline: input.orchestrationAwareRequirementsState.promptTimeline ?? [],
        fallbackRunsV1: input.orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
        implementationRuntimeDbBundle: input.implementationRuntimeDbBundle,
      })
    ) {
      return;
    }

    try {
      const result = await recoverServerQuickRunContinuation({ projectId: pid });
      if (result.orchestrationPatch) {
        input.applyOrchestrationPatch(
          input.enrichOrchestrationPatch(
            result.orchestrationPatch as PrototypeExecutionOrchestrationPersistInput,
          ),
        );
      }
      if (result.dispatchOutcome === "dispatched" || result.dispatchOk) {
        input.showToast("서버에서 다음 CodeTask Cursor 실행을 복구했습니다.");
      } else if (result.dispatchReason) {
        input.showToast(
          `다음 CodeTask 실행 복구: ${formatQuickRunContinuationReason(result.dispatchReason)}`,
        );
      }
    } catch {
      // recovery is best-effort
    }
  }, [
    input.projectId,
    input.orchestrationAwareRequirementsState.promptTimeline,
    input.orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
    input.implementationRuntimeDbBundle,
    input.requirementsStateJsonRef,
    input.enrichOrchestrationPatch,
    input.applyOrchestrationPatch,
    input.showToast,
  ]);

  useEffect(() => {
    if (input.autoQualityGateStatus !== "passed") {
      return;
    }
    const timer = window.setTimeout(() => {
      void recoverIfNeeded();
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [
    input.autoQualityGateStatus,
    input.autoQualityGateSourceCommitSha,
    recoverIfNeeded,
  ]);
}
