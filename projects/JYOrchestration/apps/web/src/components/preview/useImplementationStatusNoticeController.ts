"use client";

import { useCallback, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { buildImplementationBootstrapInput } from "@/lib/prototype/prototypeExecutionEnvSnapshot";
import { resolveIntegratedAppPreviewReadyFromOrchestration } from "@/lib/prototype/implementationPreviewReadiness";
import {
  buildImplementationRoleCheckSummary,
  buildImplementationStatusQueryMessage,
  buildImplementationStatusQueryTimelineEntry,
  hasImplementationRoleCheckDetailsShown,
} from "@/lib/prototype/implementationOrchestrationSummary";
import type { ImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
import { buildPlanningImplementationSeedCheckResult } from "@/lib/requirements/planningImplementationSeedActions";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  appendPromptTimeline,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  readImplementationStageChatMessages,
  readImplementationStageChatPatch,
} from "@/lib/prototype/implementationStageChatSnapshot";
import { resolveOrchestrationAwareRequirementsState } from "@/lib/prototype/effectiveImplementationState";
import type { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";

/**
 * Controls implementation-stage status and notice actions.
 *
 * Scope:
 * - append implementation task-list AI notices
 * - suppress task-list notices after integrated Preview is ready
 * - show implementation seed readiness check
 * - append implementation status query responses from chips
 * - show role-check details once
 *
 * Not scope:
 * - CodeTask execution
 * - Quick Run execution
 * - GitHub verification
 * - board rendering
 */
export type ImplementationStatusNoticeControllerInput = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly requirementsStateJsonRef: RefObject<unknown>;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly orchestrationAwareRequirementsStateRef: RefObject<
    ReturnType<typeof resolveOrchestrationAwareRequirementsState>
  >;
  readonly implementationBootstrapInput: ReturnType<typeof buildImplementationBootstrapInput> | null;
  readonly planningSlotDefinitions: ReturnType<typeof buildDynamicServicePlanningSlotDefinitions>;
  readonly setImplementationStageNoticeModal: Dispatch<
    SetStateAction<{
      readonly body: string;
      readonly actionLabels?: readonly string[];
    } | null>
  >;
  readonly applyImplementationOrchestrationResult: (input: {
    readonly messages?: readonly RequirementsMessage[];
    readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  }) => void;
  readonly persistChatToDb: (
    chat?: unknown,
    orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput,
    message?: unknown,
    options?: { readonly awaitServer?: boolean; readonly force?: boolean },
  ) => Promise<unknown> | void;
  readonly appendAiNoticeForImplementation: (content: string) => void;
}>;

export type ImplementationStatusNoticeControllerValue = Readonly<{
  readonly appendImplementationTaskListAiMessage: (message: RequirementsMessage) => void;
  readonly appendStatusQueryFromChip: (intent: ImplementationStatusQueryIntent) => void;
  readonly showRoleCheckDetails: () => void;
  readonly showImplementationSeedReadinessCheck: () => void;
}>;

export function useImplementationStatusNoticeController(
  input: ImplementationStatusNoticeControllerInput,
): ImplementationStatusNoticeControllerValue {
  const appendStatusQueryFromChip = useCallback(
    (intent: ImplementationStatusQueryIntent) => {
      if (!input.implementationBootstrapInput) {
        input.appendAiNoticeForImplementation(
          "환경 점검 결과를 표시할 수 없습니다. [환경 점검 결과]를 다시 선택해 주세요.",
        );
        return;
      }
      const prior = readImplementationStageChatMessages(input.requirementsStateJsonRef.current);
      if (intent === "role_check_details" && hasImplementationRoleCheckDetailsShown(prior)) {
        input.appendAiNoticeForImplementation("역할별 점검 결과가 이미 표시되어 있습니다.");
        return;
      }
      const roleCheckSummary = buildImplementationRoleCheckSummary(input.implementationBootstrapInput);
      const aiMessage = buildImplementationStatusQueryMessage({
        intent,
        summaryInput: input.implementationBootstrapInput,
        roleCheckSummary,
      });
      if (!aiMessage) return;
      let timeline = input.parsedRequirementsState.promptTimeline;
      timeline = appendPromptTimeline(
        timeline,
        buildImplementationStatusQueryTimelineEntry({
          query: intent,
          summaryInput: input.implementationBootstrapInput,
          roleCheckSummary,
        }),
      );
      const chatPatch = readImplementationStageChatPatch(input.requirementsStateJsonRef.current);
      void input.persistChatToDb(chatPatch, { promptTimeline: timeline }, undefined, { force: true });
      input.appendAiNoticeForImplementation(String(aiMessage.content ?? "").trim());
    },
    [
      input.implementationBootstrapInput,
      input.requirementsStateJsonRef,
      input.parsedRequirementsState.promptTimeline,
      input.persistChatToDb,
      input.appendAiNoticeForImplementation,
    ],
  );

  const showRoleCheckDetails = useCallback(() => {
    appendStatusQueryFromChip("role_check_details");
  }, [appendStatusQueryFromChip]);

  const appendImplementationTaskListAiMessage = useCallback(
    (message: RequirementsMessage) => {
      const pid = input.projectId.trim();
      if (
        pid &&
        resolveIntegratedAppPreviewReadyFromOrchestration({
          projectId: pid,
          orchestration: input.orchestrationAwareRequirementsStateRef.current,
        })
      ) {
        return;
      }
      const text = String(message.content ?? "").trim();
      const suggestions = (message.meta as { interviewSuggestions?: readonly string[] } | undefined)
        ?.interviewSuggestions;
      const actionLabels = suggestions?.filter((l) => String(l ?? "").trim());
      if (text || actionLabels?.length) {
        input.setImplementationStageNoticeModal({
          body: text,
          ...(actionLabels?.length ? { actionLabels: [...actionLabels] } : {}),
        });
      }
    },
    [input.projectId, input.orchestrationAwareRequirementsStateRef, input.setImplementationStageNoticeModal],
  );

  const showImplementationSeedReadinessCheck = useCallback(() => {
    const pid = input.projectId.trim();
    if (!pid) return;
    const result = buildPlanningImplementationSeedCheckResult({
      projectId: pid,
      orchestration: input.parsedRequirementsState.singleChatOrchestrationV1,
      definitions: input.planningSlotDefinitions,
      promptTimeline: input.parsedRequirementsState.promptTimeline,
    });
    input.applyImplementationOrchestrationResult({
      orchestrationPatch: result.orchestrationPatch,
    });
    input.appendAiNoticeForImplementation(String(result.message.content ?? "").trim());
  }, [
    input.projectId,
    input.parsedRequirementsState.singleChatOrchestrationV1,
    input.parsedRequirementsState.promptTimeline,
    input.planningSlotDefinitions,
    input.applyImplementationOrchestrationResult,
    input.appendAiNoticeForImplementation,
  ]);

  return {
    appendImplementationTaskListAiMessage,
    appendStatusQueryFromChip,
    showRoleCheckDetails,
    showImplementationSeedReadinessCheck,
  };
}
