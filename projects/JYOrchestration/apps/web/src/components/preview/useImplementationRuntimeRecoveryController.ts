"use client";

import { useCallback, useEffect, type MutableRefObject } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { hasActiveCodeTaskGithubPollingState } from "@/lib/prototype/implementationCodeTaskGithubPollingState";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { resolveEffectiveCodeTaskExecutionQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import { resolveOrchestrationAwareRequirementsState } from "@/lib/prototype/effectiveImplementationState";

/**
 * Controls implementation runtime recovery and retry actions.
 *
 * Scope:
 * - retry a failed CodeTask through the runtime API
 * - recover stuck Quick Run GitHub verification once on state changes
 * - poll recovery while Quick Run and TaskCursor are in-flight
 * - reload runtime DB after recovery/retry actions
 *
 * Not scope:
 * - Quick Run execution internals
 * - GitHub verification implementation
 * - board rendering
 * - integration pipeline execution
 */
export type ImplementationRuntimeRecoveryControllerInput = Readonly<{
  readonly projectId: string;
  readonly orchestrationAwareRequirementsState: ReturnType<
    typeof resolveOrchestrationAwareRequirementsState
  >;
  readonly effectiveCodeTaskExecutionQueueV1: ReturnType<
    typeof resolveEffectiveCodeTaskExecutionQueue
  > | null;
  readonly quickRunStuckGithubVerifyRef: MutableRefObject<string | null>;
  readonly recoverQuickRunStuckGithubVerify: () => Promise<void> | void;
  readonly loadImplementationRuntimeDb: (input?: { readonly recover?: boolean }) => Promise<void> | void;
  readonly applyGithubPollingOrchestrationPatch?: (patch: unknown) => void;
}>;

export type ImplementationRuntimeRecoveryControllerValue = Readonly<{
  readonly handleRetryFailedCodeTask: (codeTaskId: string) => Promise<void>;
}>;

export function useImplementationRuntimeRecoveryController(
  input: ImplementationRuntimeRecoveryControllerInput,
): ImplementationRuntimeRecoveryControllerValue {
  const handleRetryFailedCodeTask = useCallback(
    async (codeTaskId: string) => {
      const pid = input.projectId.trim();
      if (!pid || !codeTaskId.trim()) return;
      const res = await credentialsIncludeFetch(
        "/api/prototype/implementation-runtime/retry-failed-task",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: pid, codeTaskId: codeTaskId.trim() }),
        },
      );
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!json.success) {
        window.alert(json.message ?? "실패 작업 재실행을 준비하지 못했습니다.");
        return;
      }
      await input.loadImplementationRuntimeDb({ recover: true });
    },
    [input.projectId, input.loadImplementationRuntimeDb],
  );

  useEffect(() => {
    void input.recoverQuickRunStuckGithubVerify();
  }, [
    input.recoverQuickRunStuckGithubVerify,
    input.orchestrationAwareRequirementsState.implementationQuickRunV1?.status,
    input.orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
    input.orchestrationAwareRequirementsState.taskCursorExecutionV1?.cursorRunId,
    input.orchestrationAwareRequirementsState.taskCursorExecutionV1?.status,
    input.orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1,
    input.effectiveCodeTaskExecutionQueueV1?.status,
    input.effectiveCodeTaskExecutionQueueV1?.currentIndex,
  ]);

  useEffect(() => {
    const pid = input.projectId.trim();
    if (!pid) return;

    const hasGithubPolling = hasActiveCodeTaskGithubPollingState(
      input.orchestrationAwareRequirementsState,
    );
    const quickRun = parseImplementationQuickRunV1(
      input.orchestrationAwareRequirementsState.implementationQuickRunV1,
    );
    const cursor = parseTaskCursorExecutionV1(
      input.orchestrationAwareRequirementsState.taskCursorExecutionV1,
    );
    const quickRunInFlight = quickRun?.status === "running" && cursor && isInFlightTaskCursorExecution(cursor);
    if (!hasGithubPolling && !quickRunInFlight) return;

    const tick = () => {
      if (hasGithubPolling) {
        void credentialsIncludeFetch("/api/prototype/implementation/github-polling/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: pid }),
        })
          .then(async (res) => {
            const json = (await res.json()) as {
              success?: boolean;
              orchestrationPatch?: unknown;
            };
            if (json.success && json.orchestrationPatch && input.applyGithubPollingOrchestrationPatch) {
              input.applyGithubPollingOrchestrationPatch(json.orchestrationPatch);
            }
          })
          .catch(() => undefined);
      }
      if (quickRunInFlight) {
        input.quickRunStuckGithubVerifyRef.current = null;
        void input.recoverQuickRunStuckGithubVerify();
      }
      void input.loadImplementationRuntimeDb({ recover: true });
    };
    tick();
    const interval = window.setInterval(tick, 10_000);
    return () => window.clearInterval(interval);
  }, [
    input.projectId,
    input.recoverQuickRunStuckGithubVerify,
    input.loadImplementationRuntimeDb,
    input.applyGithubPollingOrchestrationPatch,
    input.orchestrationAwareRequirementsState.implementationCodeTaskGithubPollingV1,
    input.orchestrationAwareRequirementsState.implementationQuickRunV1?.status,
    input.orchestrationAwareRequirementsState.taskCursorExecutionV1?.status,
    input.orchestrationAwareRequirementsState.taskCursorExecutionV1?.cursorRunId,
    input.effectiveCodeTaskExecutionQueueV1?.status,
    input.quickRunStuckGithubVerifyRef,
    input.orchestrationAwareRequirementsState,
  ]);

  return {
    handleRetryFailedCodeTask,
  };
}
