import { useCallback } from "react";
import { mergeRequirementsStateWithRuntime } from "@/lib/prototype/implementationRuntimeSync";
import { mergeImplementationExecutionLogTimeline } from "@/lib/prototype/implementationOrchestrationExecutionLog";
import {
  buildPrototypeExecutionOrchestrationPersistPatch,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { usePrototypeExecutionSingleChat } from "@/components/preview/usePrototypeExecutionSingleChat";

export function useApplyImplementationOrchestrationResult(input: {
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly requirementsStateJsonRef: React.MutableRefObject<unknown>;
  readonly orchestrationPersistSeqRef: React.MutableRefObject<number>;
  readonly executionSingleChat: ReturnType<typeof usePrototypeExecutionSingleChat>;
  readonly persistChatToDb: (
    chatPatch?: {
      messages: readonly RequirementsMessage[];
      slots: readonly import("@/lib/prototype/prototypeExecutionSingleChatTypes").PrototypeExecutionInterviewSlot[];
      answers: Readonly<Record<string, string>>;
      currentSlotKey: string | null;
    },
    orchestrationPatch?: Omit<PrototypeExecutionOrchestrationPersistInput, "chat">,
    persistSeq?: number,
    persistOptions?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<{ readonly serverSaved: boolean } | void>;
  readonly applyPendingFromOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput | undefined,
  ) => void;
  readonly onRequirementsStateJsonChange?: (next: unknown) => void;
}): ((
  orchestrationInput: {
    readonly messages: readonly RequirementsMessage[];
    readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  },
  options?: { readonly persist?: boolean; readonly forcePersist?: boolean },
) => void) {
  return useCallback(
    (
      orchestrationInput: {
        readonly messages: readonly RequirementsMessage[];
        readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
      },
      options?: { readonly persist?: boolean; readonly forcePersist?: boolean },
    ) => {
      const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
      const chatPatch = {
        messages: orchestrationInput.messages,
        slots: resolved.slots ?? [],
        answers: resolved.answers ?? {},
        currentSlotKey: resolved.currentSlotKey ?? null,
      };
      const prior = parseRequirementsStateJson(input.requirementsStateJsonRef.current);
      const mergedWithoutAutoLog = buildPrototypeExecutionOrchestrationPersistPatch(
        input.requirementsStateJsonRef.current,
        {
          chat: chatPatch,
          ...orchestrationInput.orchestrationPatch,
        },
      );
      const promptTimeline = mergeImplementationExecutionLogTimeline({
        prior,
        next: mergedWithoutAutoLog,
        patch: orchestrationInput.orchestrationPatch,
      });
      const mergedBase =
        promptTimeline.length > 0
          ? { ...mergedWithoutAutoLog, promptTimeline }
          : mergedWithoutAutoLog;
      const mergedRequirementsState = mergeRequirementsStateWithRuntime({
        projectId: input.projectId.trim(),
        state: mergedBase as Record<string, unknown>,
      }) as typeof mergedBase;
      const orchestrationPatchWithTimeline: PrototypeExecutionOrchestrationPersistInput = {
        ...orchestrationInput.orchestrationPatch,
        ...(promptTimeline.length ? { promptTimeline } : {}),
      };
      input.requirementsStateJsonRef.current = mergedRequirementsState;
      input.applyPendingFromOrchestrationPatch(orchestrationPatchWithTimeline);
      input.executionSingleChat.applyPersistedMessages(orchestrationInput.messages);
      if (options?.persist !== false) {
        const persistSeq = ++input.orchestrationPersistSeqRef.current;
        void input.persistChatToDb(
          chatPatch,
          orchestrationPatchWithTimeline,
          persistSeq,
          options?.forcePersist ? { force: true } : undefined,
        );
      } else {
        queueMicrotask(() => {
          input.onRequirementsStateJsonChange?.(mergedRequirementsState);
        });
      }
    },
    [
      input.projectId,
      input.requirementsStateJson,
      input.requirementsStateJsonRef,
      input.orchestrationPersistSeqRef,
      input.executionSingleChat,
      input.persistChatToDb,
      input.applyPendingFromOrchestrationPatch,
      input.onRequirementsStateJsonChange,
    ],
  );
}
