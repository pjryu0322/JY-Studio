"use client";

import { useMemo } from "react";
import { evaluateCursorExecutionAvailability } from "@/lib/prototype/cursorExecutionAvailability";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  resolveEffectiveImplementationState,
  type PendingImplementationPatch,
} from "@/lib/prototype/effectiveImplementationState";
import { buildWipChipHandlerSlice } from "@/lib/prototype/prototypeExecutionWipChipHandlers";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * Controls implementation-stage WIP chip handler wiring.
 *
 * Scope:
 * - build WIP chip handler slice
 * - adapt orchestration patch persistence for WIP chip actions
 * - connect platform SCM post-commit callback
 * - keep WIP chip wiring outside the parent panel hook
 *
 * Not scope:
 * - WIP chip UI rendering
 * - platform SCM execution internals
 * - Quick Run execution
 * - GitHub verification
 * - board rendering
 */
export type ImplementationWipChipHandlerControllerInput = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly pendingImplementationPatch: PendingImplementationPatch;
  readonly orchestrationAwareRequirementsState: RequirementsStateJson;
  readonly effectiveImplementationState: ReturnType<typeof resolveEffectiveImplementationState>;
  readonly executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  readonly executePlatformScmAfterRequest: (wip: CodeAgentWipExecutionV1) => void;
  readonly canApplyGit: boolean | undefined;
  readonly applyImplementationOrchestrationResult: (input: {
    readonly messages?: readonly RequirementsMessage[];
    readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
  readonly applyPendingFromOrchestrationPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput | undefined,
  ) => void;
  readonly persistChatToDb: (
    chat?: unknown,
    orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput,
    message?: unknown,
    options?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<unknown> | void;
  readonly appendAiNoticeForImplementation: (message: string) => void;
  readonly appendUserNotice: (message: string) => void;
}>;

export type ImplementationWipChipHandlerControllerValue = Readonly<{
  readonly wipChipHandlers: ReturnType<typeof buildWipChipHandlerSlice>;
}>;

export function useImplementationWipChipHandlerController(
  input: ImplementationWipChipHandlerControllerInput,
): ImplementationWipChipHandlerControllerValue {
  const wipChipHandlers = useMemo(
    () =>
      buildWipChipHandlerSlice({
        projectId: input.projectId,
        requirementsStateJson: input.requirementsStateJson,
        baseRequirementsState: input.parsedRequirementsState,
        pendingPatch: input.pendingImplementationPatch,
        parsedState: input.orchestrationAwareRequirementsState,
        envOk: input.effectiveImplementationState.envOk,
        designOk: input.effectiveImplementationState.designOk,
        cursorApiConfigured: evaluateCursorExecutionAvailability({ setup: input.executionSetupRow }).ready,
        applyMessages: () => {},
        appendNotice: (text) => input.appendAiNoticeForImplementation(text),
        persistOrchestration: (chat, orch) => {
          if (chat && orch) {
            input.applyImplementationOrchestrationResult({
              messages: chat.messages,
              orchestrationPatch: orch,
            });
            return;
          }
          input.applyPendingFromOrchestrationPatch(orch);
          void input.persistChatToDb(chat, orch);
        },
        appendUserNotice: input.appendUserNotice,
        onAfterScmCommitRequested: input.executePlatformScmAfterRequest,
        canApplyGit: input.canApplyGit,
      }),
    [
      input.projectId,
      input.requirementsStateJson,
      input.parsedRequirementsState,
      input.pendingImplementationPatch,
      input.orchestrationAwareRequirementsState,
      input.effectiveImplementationState.envOk,
      input.effectiveImplementationState.designOk,
      input.executionSetupRow,
      input.persistChatToDb,
      input.applyPendingFromOrchestrationPatch,
      input.applyImplementationOrchestrationResult,
      input.executePlatformScmAfterRequest,
      input.canApplyGit,
      input.appendAiNoticeForImplementation,
      input.appendUserNotice,
    ],
  );

  return { wipChipHandlers };
}
