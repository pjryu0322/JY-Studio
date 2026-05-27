import type { PrototypeExecutionOperationalSendResult } from "@/components/preview/usePrototypeExecutionSingleChat";
import { buildCreateWorkPlanFromChatOperationalResult } from "@/lib/prototype/implementationCreateWorkPlanFromChat";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import {
  buildImplementationActionGateBlockedTimelineEntry,
  buildImplementationActionRouteTimelineEntries,
  buildImplementationIntentRoutedTimelineEntry,
} from "@/lib/prototype/implementationIntentTimeline";
import type {
  ImplementationActionId,
  ImplementationIntentClassification,
} from "@/lib/prototype/implementationIntentRouterTypes";
import { buildImplementationRouterAssistantReply } from "@/lib/prototype/implementationRouterMessages";
import type { ImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
import { detectImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
import {
  buildImplementationUserFeedbackAppliedMessage,
  buildImplementationUserFeedbackPatch,
  type ImplementationUserFeedbackPatchV1,
} from "@/lib/prototype/implementationUserFeedback";
import {
  implementationStatusQueryFromAction,
  routeImplementationUserInput,
  type RouteImplementationUserInputParams,
} from "@/lib/prototype/routeImplementationUserInput";

export type ImplementationOperationalSendHandlers = Readonly<{
  appendNotice: (message: string) => void;
  showToast: (message: string) => void;
  focusChatInput: () => void;
  startWorkPlanGeneration: () => void;
  openPlannerPrompt: () => void;
  openEnvSettings: () => void;
  openArtifactHub: () => void;
  buildStatusQueryResult: (intent: ImplementationStatusQueryIntent) => PrototypeExecutionOperationalSendResult | null;
  persistRequirementPatch: (patch: ImplementationUserFeedbackPatchV1) => void;
}>;

export type ImplementationOperationalSendContext = Readonly<{
  text: string;
  userMsg: RequirementsMessage;
  isDraftGenerationComplete: boolean;
  isRunningState: boolean;
  envOk: boolean;
  designOk: boolean;
  routeParams: RouteImplementationUserInputParams;
  requirementsStateJson: unknown;
  projectId: string;
  projectArtifacts: readonly ProjectArtifact[];
  orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
  implementationSeedV1?: ImplementationSeedV1 | null;
  implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
  promptTimeline?: readonly RequirementsPromptTimelineEntry[];
}>;

function buildRoutedTimeline(classification: ImplementationIntentClassification | null | undefined) {
  return classification ? [buildImplementationIntentRoutedTimelineEntry({ classification })] : [];
}

function routeAndExecutedTimeline(
  classification: ImplementationIntentClassification | undefined,
  actionId: ImplementationActionId,
): readonly RequirementsPromptTimelineEntry[] {
  if (!classification) return [];
  return buildImplementationActionRouteTimelineEntries({ actionId, classification });
}

function timelineOnlyAfterAction(
  classification: ImplementationIntentClassification | undefined,
  actionId: ImplementationActionId,
): PrototypeExecutionOperationalSendResult {
  return classification
    ? { kind: "timeline_only", timelineEntries: routeAndExecutedTimeline(classification, actionId) }
    : "handled";
}

function runHandlerWithActionTimeline(
  handlers: ImplementationOperationalSendHandlers,
  classification: ImplementationIntentClassification | undefined,
  actionId: ImplementationActionId,
  run: () => void,
): PrototypeExecutionOperationalSendResult {
  run();
  return timelineOnlyAfterAction(classification, actionId);
}

function withActionRouteTimeline(
  result: PrototypeExecutionOperationalSendResult,
  classification: ImplementationIntentClassification | undefined,
  actionId: ImplementationActionId,
): PrototypeExecutionOperationalSendResult {
  if (!classification || typeof result !== "object") return result;

  const executed = routeAndExecutedTimeline(classification, actionId);
  const routedOnly = buildRoutedTimeline(classification);

  if (result.kind === "apply_conversation") {
    return { ...result, timelineEntries: executed };
  }
  if (result.kind === "assistant_reply" && result.afterPersist === "start_prototype_work_plan") {
    return { ...result, timelineEntries: executed };
  }
  if (result.kind === "assistant_reply") {
    return { ...result, timelineEntries: routedOnly };
  }
  return result;
}

function mergeStatusQueryWithRouteTimeline(
  statusResult: PrototypeExecutionOperationalSendResult,
  classification: ImplementationIntentClassification,
): PrototypeExecutionOperationalSendResult {
  if (typeof statusResult === "object" && statusResult.kind === "status_query") {
    return {
      ...statusResult,
      timelineEntries: [...(statusResult.timelineEntries ?? []), ...buildRoutedTimeline(classification)],
    };
  }
  return statusResult;
}

function executeRoutedAction(
  actionId: ImplementationActionId,
  input: ImplementationOperationalSendContext,
  handlers: ImplementationOperationalSendHandlers,
  classification?: ImplementationIntentClassification,
): PrototypeExecutionOperationalSendResult {
  switch (actionId) {
    case "CREATE_WORK_PLAN":
      return withActionRouteTimeline(
        buildCreateWorkPlanFromChatOperationalResult({
          userMsg: input.userMsg,
          requirementsStateJson: input.requirementsStateJson,
          projectId: input.projectId,
          projectArtifacts: input.projectArtifacts,
          orchestration: input.orchestration,
          slotDefinitions: input.slotDefinitions,
          implementationSeedV1: input.implementationSeedV1,
          implementationWorkPlanDraftV1: input.implementationWorkPlanDraftV1,
          envOk: input.envOk,
          designOk: input.designOk,
          promptTimeline: input.promptTimeline,
        }),
        classification,
        actionId,
      );
    case "OPEN_PLANNER_PROMPT":
      return runHandlerWithActionTimeline(handlers, classification, actionId, () => handlers.openPlannerPrompt());
    case "OPEN_ENV_SETTINGS":
      return runHandlerWithActionTimeline(handlers, classification, actionId, () => handlers.openEnvSettings());
    case "SHOW_ARTIFACTS":
      return runHandlerWithActionTimeline(handlers, classification, actionId, () => handlers.openArtifactHub());
    case "DIRECT_IMPLEMENTATION_SCOPE_INPUT":
      return runHandlerWithActionTimeline(handlers, classification, actionId, () => {
        handlers.showToast("아래 입력란에 구현 범위·요구사항을 적고 전송해 주세요.");
        handlers.focusChatInput();
      });
    default:
      return timelineOnlyAfterAction(classification, actionId);
  }
}

function resolveRoutedInput(
  route: Awaited<ReturnType<typeof routeImplementationUserInput>>,
  input: ImplementationOperationalSendContext,
  handlers: ImplementationOperationalSendHandlers,
): PrototypeExecutionOperationalSendResult | null {
  switch (route.kind) {
    case "show_status": {
      const statusIntent = implementationStatusQueryFromAction(route.actionId);
      if (statusIntent === "none") return "handled";
      const statusResult = handlers.buildStatusQueryResult(statusIntent);
      if (!statusResult) {
        handlers.appendNotice("환경 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
        return "handled";
      }
      return mergeStatusQueryWithRouteTimeline(statusResult, route.classification);
    }
    case "execute_action":
      return executeRoutedAction(route.actionId, input, handlers, route.classification);
    case "apply_requirement_then_execute": {
      const nowIso = new Date().toISOString();
      const sourceId = `route-${nowIso}`;
      const patch = buildImplementationUserFeedbackPatch({
        text: input.text,
        sourceMessageId: sourceId,
        nowIso,
        extractedRulesOverride: route.extractedRules,
      });
      handlers.persistRequirementPatch(patch);
      handlers.startWorkPlanGeneration();
      return {
        kind: "assistant_reply",
        aiMessage: buildImplementationUserFeedbackAppliedMessage({ patch, envOk: input.envOk }),
        timelineEntries: routeAndExecutedTimeline(route.classification, route.actionId),
      };
    }
    case "gate_blocked":
      return {
        kind: "assistant_reply",
        aiMessage: buildImplementationRouterAssistantReply({
          content: route.message,
          interviewSuggestions: route.interviewSuggestions,
        }),
        timelineEntries: [
          ...buildRoutedTimeline(route.classification),
          buildImplementationActionGateBlockedTimelineEntry({
            actionId: route.actionId,
            reason: route.message,
          }),
        ],
      };
    case "clarification":
      return {
        kind: "assistant_reply",
        aiMessage: buildImplementationRouterAssistantReply({ content: route.question }),
        timelineEntries: buildRoutedTimeline(route.classification),
      };
    case "fallback_llm_turn":
      return null;
  }
}

function resolveLegacyStatusQuery(
  text: string,
  handlers: ImplementationOperationalSendHandlers,
): PrototypeExecutionOperationalSendResult | null {
  const statusIntent = detectImplementationStatusQueryIntent(text);
  if (statusIntent === "none") return null;
  const statusResult = handlers.buildStatusQueryResult(statusIntent);
  if (!statusResult) {
    handlers.appendNotice("환경 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
    return "handled";
  }
  return statusResult;
}

/** Intent router + legacy status fallback. Guards (draft/running/regenerate)는 호출측에서 처리. */
export async function resolveImplementationOperationalSend(
  input: ImplementationOperationalSendContext,
  handlers: ImplementationOperationalSendHandlers,
): Promise<PrototypeExecutionOperationalSendResult> {
  if (input.isDraftGenerationComplete) {
    handlers.appendNotice(
      "새 요청은 「처음부터 다시 생성」으로 진행해 주세요. 타임라인의 버튼을 사용하거나 실행 설정에서 다시 시작할 수 있습니다.",
    );
    return "handled";
  }

  if (input.isRunningState) {
    handlers.appendNotice("실행 중에는 작업계획을 수정할 수 없습니다. 중단 후 재계획할 수 있습니다.");
    return "handled";
  }

  const route = await routeImplementationUserInput({
    ...input.routeParams,
    text: input.text,
  });

  const routed = resolveRoutedInput(route, input, handlers);
  if (routed) return routed;

  const legacyStatus = resolveLegacyStatusQuery(input.text, handlers);
  if (legacyStatus) return legacyStatus;

  return "continue";
}
