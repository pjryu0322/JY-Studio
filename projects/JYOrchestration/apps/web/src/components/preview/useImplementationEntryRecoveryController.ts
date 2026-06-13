"use client";

import { useEffect } from "react";
import {
  buildImplementationEntryCursorWorkItemsRecovery,
  buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry,
} from "@/lib/prototype/implementationEntryState";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import { hasImplementationTaskListReady } from "@/lib/requirements/implementationTaskList";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Controls implementation entry recovery for Cursor work items.
 *
 * Scope:
 * - regenerate missing Cursor work items after implementation seed/task-list are ready
 * - append recovery timeline entry
 * - persist regenerated Cursor work items
 *
 * Not scope:
 * - task-list generation
 * - Cursor execution
 * - Quick Run execution
 * - board rendering
 */
export type ImplementationEntryRecoveryControllerInput = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly persistChatToDb: (
    chat?: unknown,
    orchestrationPatch?: unknown,
    message?: unknown,
    options?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<unknown> | void;
}>;

export function useImplementationEntryRecoveryController(
  input: ImplementationEntryRecoveryControllerInput,
): void {
  useEffect(() => {
    const pid = input.projectId.trim();
    const taskList = input.parsedRequirementsState.implementationTaskListV1;
    if (!pid || !input.parsedRequirementsState.implementationSeedV1) return;
    if (!hasImplementationTaskListReady(taskList)) return;
    if ((input.parsedRequirementsState.cursorWorkItemsV1?.length ?? 0) > 0) return;

    const recovery = buildImplementationEntryCursorWorkItemsRecovery({
      projectId: pid,
      taskList: taskList!,
      existingCursorWorkItems: input.parsedRequirementsState.cursorWorkItemsV1,
    });
    if (!recovery.regenerated) return;

    const nowIso = new Date().toISOString();
    void input.persistChatToDb(resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson), {
      cursorWorkItemsV1: [...recovery.cursorWorkItems],
      promptTimeline: [
        ...(input.parsedRequirementsState.promptTimeline ?? []),
        buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry({
          projectId: pid,
          taskCount: taskList!.tasks.length,
          developerTaskCount: taskList!.roleSummary?.developer ?? 0,
          nowIso,
        }),
      ],
    });
  }, [
    input.parsedRequirementsState.implementationTaskListV1,
    input.parsedRequirementsState.cursorWorkItemsV1,
    input.parsedRequirementsState.promptTimeline,
    input.parsedRequirementsState.implementationSeedV1,
    input.persistChatToDb,
    input.projectId,
    input.requirementsStateJson,
  ]);
}
