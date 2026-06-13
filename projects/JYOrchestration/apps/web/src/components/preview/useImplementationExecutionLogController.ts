"use client";

import { useCallback, useState, type MutableRefObject, type RefObject } from "react";
import { stripExecutionLogTimelineEntries } from "@/lib/prototype/promptTimelineExecutionLogTabs";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolveOrchestrationAwareRequirementsState } from "@/lib/prototype/effectiveImplementationState";

/**
 * Controls implementation-stage execution log UI actions.
 *
 * Scope:
 * - open execution log modal
 * - clear execution log timeline entries
 * - persist promptTimeline after log cleanup
 *
 * Not scope:
 * - rendering execution log modal
 * - runtime job polling
 * - CodeTask execution
 * - GitHub verification
 */
export type ImplementationExecutionLogControllerInput = Readonly<{
  readonly orchestrationAwareRequirementsStateRef: RefObject<
    ReturnType<typeof resolveOrchestrationAwareRequirementsState>
  >;
  readonly applyPendingFromOrchestrationPatchRef: MutableRefObject<
    (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => void
  >;
  readonly persistChatToDb: (
    chat?: unknown,
    orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput,
    message?: unknown,
    options?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<unknown> | void;
}>;

export type ImplementationExecutionLogControllerValue = Readonly<{
  readonly implementationExecutionLogModalOpen: boolean;
  readonly setImplementationExecutionLogModalOpen: (open: boolean) => void;
  readonly onOpenImplementationExecutionLog: () => void;
  readonly onClearImplementationExecutionLog: () => void;
}>;

export function useImplementationExecutionLogController(
  input: ImplementationExecutionLogControllerInput,
): ImplementationExecutionLogControllerValue {
  const [implementationExecutionLogModalOpen, setImplementationExecutionLogModalOpen] =
    useState(false);

  const onOpenImplementationExecutionLog = useCallback(() => {
    setImplementationExecutionLogModalOpen(true);
  }, []);

  const onClearImplementationExecutionLog = useCallback(() => {
    const imp = input.orchestrationAwareRequirementsStateRef.current;
    if (!imp) return;
    const current = imp.promptTimeline ?? [];
    const next = stripExecutionLogTimelineEntries(current);
    if (next.length === current.length) return;
    input.applyPendingFromOrchestrationPatchRef.current({ promptTimeline: next });
    void input.persistChatToDb(undefined, { promptTimeline: next }, undefined, { force: true });
  }, [input.persistChatToDb]);

  return {
    implementationExecutionLogModalOpen,
    setImplementationExecutionLogModalOpen,
    onOpenImplementationExecutionLog,
    onClearImplementationExecutionLog,
  };
}
