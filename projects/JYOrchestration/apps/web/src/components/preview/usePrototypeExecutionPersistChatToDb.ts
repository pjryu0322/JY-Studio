import { useCallback, useRef } from "react";
import { mergeRequirementsStateWithRuntime } from "@/lib/prototype/implementationRuntimeSync";
import { mergeImplementationExecutionLogTimeline } from "@/lib/prototype/implementationOrchestrationExecutionLog";
import {
  buildPrototypeExecutionOrchestrationPersistPatch,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { buildPromptTimelineEntryFingerprint } from "@/lib/requirements/promptTimelineState";
import { pickPersistentExecutionLogTimelineEntries } from "@/lib/prototype/promptTimelineExecutionLogTabs";
import { parseRequirementsStateJson, mergeRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { patchSpecWorkspaceRequest } from "@/lib/project/specWorkspaceClient";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { PrototypeExecutionInterviewSlot } from "@/lib/prototype/prototypeExecutionSingleChatTypes";

export function usePrototypeExecutionPersistChatToDb(input: {
  readonly projectId: string;
  readonly timelineCards: readonly { readonly id: string; readonly at: string }[];
  readonly requirementsStateJsonRef: React.MutableRefObject<unknown>;
  readonly applyPendingFromOrchestrationPatchRef: React.MutableRefObject<
    (patch: PrototypeExecutionOrchestrationPersistInput | undefined) => void
  >;
  readonly onRequirementsStateJsonChange?: (next: unknown) => void;
}): Readonly<{
  readonly orchestrationPersistSeqRef: React.MutableRefObject<number>;
  readonly persistChatToDb: (
    chatPatch?: {
      messages: readonly RequirementsMessage[];
      slots: readonly PrototypeExecutionInterviewSlot[];
      answers: Readonly<Record<string, string>>;
      currentSlotKey: string | null;
    },
    orchestrationPatch?: Omit<PrototypeExecutionOrchestrationPersistInput, "chat">,
    persistSeq?: number,
    persistOptions?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<{ readonly serverSaved: boolean } | void>;
}> {
  const lastPersistedChatFingerprintRef = useRef("");
  const orchestrationPersistSeqRef = useRef(0);

  const persistChatToDb = useCallback(
    async (
      chatPatch?: {
        messages: readonly RequirementsMessage[];
        slots: readonly PrototypeExecutionInterviewSlot[];
        answers: Readonly<Record<string, string>>;
        currentSlotKey: string | null;
      },
      orchestrationPatch?: Omit<PrototypeExecutionOrchestrationPersistInput, "chat">,
      persistSeq?: number,
      persistOptions?: { readonly awaitServer?: boolean; readonly force?: boolean },
    ): Promise<{ readonly serverSaved: boolean } | void> => {
      const mySeq = persistSeq ?? ++orchestrationPersistSeqRef.current;
      const pid = input.projectId.trim();
      if (!pid) return { serverSaved: false };
      const tc = [...input.timelineCards].slice(-300);
      const fingerprint = JSON.stringify({
        c: chatPatch?.messages?.map((m) => [m.id, m.createdAt]) ?? [],
        t: tc.map((c) => [c.id, c.at]),
        o: orchestrationPatch
          ? [
              orchestrationPatch.implementationTaskPlanV1?.createdAt,
              orchestrationPatch.cursorWorkItemsV1?.length,
              orchestrationPatch.codeAgentWipExecutionV1?.status,
              orchestrationPatch.codeAgentWipExecutionV1?.requestedAt,
              orchestrationPatch.codeAgentWipExecutionV1?.selectedTaskId,
              orchestrationPatch.codeAgentWipExecutionV1?.bridgeExecutionStatus,
              orchestrationPatch.taskCursorExecutionV1?.status,
              orchestrationPatch.taskCursorExecutionV1?.cursorRunId,
              orchestrationPatch.taskCursorExecutionV1?.updatedAt,
              (() => {
                const logs = pickPersistentExecutionLogTimelineEntries(orchestrationPatch.promptTimeline);
                const last = logs.at(-1);
                return [
                  logs.length,
                  last ? buildPromptTimelineEntryFingerprint(last) : null,
                  last?.createdAt ?? null,
                ];
              })(),
              orchestrationPatch.implementationTaskExecutionStateV1?.updatedAt,
              orchestrationPatch.implementationTaskExecutionStateV1?.summary,
              orchestrationPatch.implementationStageActionRunLogV1 ? "runlog" : null,
              orchestrationPatch.implementationQuickRunV1?.status,
              orchestrationPatch.implementationQuickRunV1?.updatedAt,
              orchestrationPatch.codeTaskExecutionRunsV1?.length,
              orchestrationPatch.implementationPreviewRuntimeV1?.generatedAt,
              orchestrationPatch.implementationPreviewScopeV1?.generatedAt,
              orchestrationPatch.implementationExecutionBoardStateV1?.updatedAt,
              orchestrationPatch.implementationExecutionBoardStateV1?.selectedCodeTaskIds,
            ]
          : null,
      });
      if (!persistOptions?.force && fingerprint === lastPersistedChatFingerprintRef.current) {
        return { serverSaved: true };
      }
      lastPersistedChatFingerprintRef.current = fingerprint;

      const prior = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
      const mergedWithoutAutoLog =
        chatPatch || orchestrationPatch
          ? buildPrototypeExecutionOrchestrationPersistPatch(input.requirementsStateJsonRef.current, {
              ...(chatPatch ? { chat: chatPatch } : {}),
              ...(orchestrationPatch ?? {}),
            })
          : mergeRequirementsStateJson(parseRequirementsStateJson(input.requirementsStateJsonRef.current), {
              prototypeWorkspaceTimelineCardsV1: tc,
              lastSavedAt: new Date().toISOString(),
            });

      const promptTimeline =
        orchestrationPatch !== undefined
          ? mergeImplementationExecutionLogTimeline({
              prior,
              next: mergedWithoutAutoLog,
              patch: orchestrationPatch,
            })
          : (mergedWithoutAutoLog.promptTimeline ?? prior.promptTimeline ?? []);

      const mergedBase =
        orchestrationPatch !== undefined && promptTimeline.length
          ? { ...mergedWithoutAutoLog, promptTimeline }
          : mergedWithoutAutoLog;

      const merged =
        chatPatch || orchestrationPatch
          ? (mergeRequirementsStateWithRuntime({
              projectId: pid,
              state: mergedBase as Record<string, unknown>,
            }) as typeof mergedBase)
          : mergedBase;

      if (mySeq !== orchestrationPersistSeqRef.current) return { serverSaved: false };

      input.requirementsStateJsonRef.current = merged;
      if (orchestrationPatch) {
        input.applyPendingFromOrchestrationPatchRef.current({
          ...orchestrationPatch,
          ...(merged.promptTimeline?.length ? { promptTimeline: merged.promptTimeline } : {}),
        });
      }

      queueMicrotask(() => {
        input.onRequirementsStateJsonChange?.(merged);
      });
      let serverSaved = true;
      if (persistOptions?.awaitServer) {
        const patchResult = await patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged });
        if (patchResult.networkError) {
          serverSaved = false;
          console.warn("[spec-workspace] PATCH network error — local state kept");
        }
      } else {
        void patchSpecWorkspaceRequest(pid, { requirementsStateJson: merged });
      }
      return { serverSaved };
    },
    [
      input.projectId,
      input.timelineCards,
      input.requirementsStateJsonRef,
      input.applyPendingFromOrchestrationPatchRef,
      input.onRequirementsStateJsonChange,
    ],
  );

  return { orchestrationPersistSeqRef, persistChatToDb };
}
