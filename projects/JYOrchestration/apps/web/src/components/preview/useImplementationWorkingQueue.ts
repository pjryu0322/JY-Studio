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
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";

export type UseImplementationWorkingQueueInput = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly requirementsStateJsonRef: RefObject<unknown>;
  readonly latestPreviewUrl?: string | null;
  readonly applyImplementationOrchestrationResult: (input: {
    readonly messages?: readonly RequirementsMessage[];
    readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
  readonly startImplementationQuickRun?: (options?: {
    readonly selectedCodeTaskIds?: readonly string[];
  }) => Promise<ImplementationStageActionRunResult>;
  readonly onApprovalNotice?: (message: string) => void;
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

  const persistQueueOnly = useCallback(
    (nextQueue: typeof queue) => {
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
    },
    [input, memoryDraft],
  );

  const setItemStatus = useCallback(
    (itemId: string, status: ImplementationWorkingQueueItem["status"]) => {
      const item = queue.items.find((i) => i.id === itemId);
      if (!item || item.status === status) return;

      if (status === "approved" && item.status === "pending") {
        const nextQueue = updateWorkingQueueItemStatus({ queue, itemId, status });
        const approvedItem = nextQueue.items.find((i) => i.id === itemId);
        if (!approvedItem) return;
        const { orchestrationPatch, createdCodeTaskIds } = createFixCodeTasksFromApprovedQueueItems(
          pid,
          [{ ...approvedItem, status: "approved" }],
          {
            requirementsStateJson: input.requirementsStateJsonRef.current,
            queue: nextQueue,
          },
        );
        const memory = buildMemoryAfterQueueChange({
          queue: orchestrationPatch.implementationWorkingQueueV1 ?? nextQueue,
          prior: memoryDraft,
          latestPreviewUrl: input.latestPreviewUrl,
        });
        const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJsonRef.current);
        input.applyImplementationOrchestrationResult({
          messages: resolved.messages,
          orchestrationPatch: {
            ...orchestrationPatch,
            implementationDeveloperMemoryDraftV1: memory,
          },
        });
        if (createdCodeTaskIds.length && input.startImplementationQuickRun) {
          void input.startImplementationQuickRun({ selectedCodeTaskIds: createdCodeTaskIds }).then((result) => {
            if (result.status === "failed" || result.status === "blocked") {
              const msg = result.message?.trim();
              if (msg) input.onApprovalNotice?.(msg);
            }
          });
        }
        return;
      }

      const nextQueue = updateWorkingQueueItemStatus({ queue, itemId, status });
      persistQueueOnly(nextQueue);
    },
    [queue, persistQueueOnly, pid, input, memoryDraft],
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
