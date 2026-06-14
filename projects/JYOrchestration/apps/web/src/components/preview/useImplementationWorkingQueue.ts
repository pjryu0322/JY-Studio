"use client";

import { useCallback, useMemo, type RefObject } from "react";
import { createFixCodeTasksFromApprovedQueueItems } from "@/lib/prototype/createFixCodeTasksFromApprovedQueueItems";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  buildMemoryAfterQueueChange,
  updateWorkingQueueItemStatus,
} from "@/lib/prototype/implementationWorkingQueueService";
import {
  readImplementationDeveloperMemoryDraftFromState,
  readImplementationWorkingQueueFromState,
} from "@/lib/prototype/implementationWorkingQueueState";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export type UseImplementationWorkingQueueInput = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly requirementsStateJsonRef: RefObject<unknown>;
  readonly latestPreviewUrl?: string | null;
  readonly applyImplementationOrchestrationResult: (input: {
    readonly messages?: readonly RequirementsMessage[];
    readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
}>;

export function useImplementationWorkingQueue(input: UseImplementationWorkingQueueInput) {
  const pid = input.projectId.trim();

  const queue = useMemo(
    () => readImplementationWorkingQueueFromState(input.requirementsStateJson, pid),
    [input.requirementsStateJson, pid],
  );

  const memoryDraft = useMemo(
    () => readImplementationDeveloperMemoryDraftFromState(input.requirementsStateJson, pid),
    [input.requirementsStateJson, pid],
  );

  const pendingCount = useMemo(
    () => queue.items.filter((item) => item.status === "pending").length,
    [queue.items],
  );

  const persistQueue = useCallback(
    (nextQueue: typeof queue, approvedForHook: readonly ImplementationWorkingQueueItem[] = []) => {
      const memory = buildMemoryAfterQueueChange({
        queue: nextQueue,
        prior: memoryDraft,
        latestPreviewUrl: input.latestPreviewUrl,
      });
      const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJsonRef.current);
      input.applyImplementationOrchestrationResult({
        messages: resolved.messages,
        orchestrationPatch: {
          implementationWorkingQueueV1: nextQueue,
          implementationDeveloperMemoryDraftV1: memory,
        },
      });
      if (approvedForHook.length) {
        void createFixCodeTasksFromApprovedQueueItems(pid, approvedForHook);
      }
    },
    [input, memoryDraft, pid],
  );

  const setItemStatus = useCallback(
    (itemId: string, status: ImplementationWorkingQueueItem["status"]) => {
      const item = queue.items.find((i) => i.id === itemId);
      if (!item || item.status === status) return;
      const nextQueue = updateWorkingQueueItemStatus({ queue, itemId, status });
      const approved =
        status === "approved" && item.status === "pending" ? ([{ ...item, status: "approved" }] as const) : [];
      persistQueue(nextQueue, approved);
    },
    [queue, persistQueue],
  );

  return {
    queue,
    memoryDraft,
    pendingCount,
    setItemStatus,
    approveItem: (itemId: string) => setItemStatus(itemId, "approved"),
    deferItem: (itemId: string) => setItemStatus(itemId, "deferred"),
    rejectItem: (itemId: string) => setItemStatus(itemId, "rejected"),
  };
}
