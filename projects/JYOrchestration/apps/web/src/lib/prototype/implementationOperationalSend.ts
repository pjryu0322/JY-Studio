import type { PrototypeExecutionOperationalSendResult } from "@/components/preview/usePrototypeExecutionSingleChat";
import {
  buildImplementationActionGateBlockedTimelineEntry,
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
  isDraftGenerationComplete: boolean;
  isRunningState: boolean;
  envOk: boolean;
  routeParams: RouteImplementationUserInputParams;
}>;

function buildRoutedTimeline(classification: ImplementationIntentClassification | null | undefined) {
  return classification ? [buildImplementationIntentRoutedTimelineEntry({ classification })] : [];
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
  handlers: ImplementationOperationalSendHandlers,
): PrototypeExecutionOperationalSendResult {
  switch (actionId) {
    case "CREATE_WORK_PLAN":
      handlers.startWorkPlanGeneration();
      return "handled";
    case "OPEN_PLANNER_PROMPT":
      handlers.openPlannerPrompt();
      return "handled";
    case "OPEN_ENV_SETTINGS":
      handlers.openEnvSettings();
      return "handled";
    case "SHOW_ARTIFACTS":
      handlers.openArtifactHub();
      return "handled";
    case "DIRECT_IMPLEMENTATION_SCOPE_INPUT":
      handlers.showToast("아래 입력란에 구현 범위·요구사항을 적고 전송해 주세요.");
      handlers.focusChatInput();
      return "handled";
    default:
      return "handled";
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
      return executeRoutedAction(route.actionId, handlers);
    case "apply_requirement_then_execute": {
      const nowIso = new Date().toISOString();
      const sourceId = `route-${nowIso}`;
      const patch = buildImplementationUserFeedbackPatch({
        text: input.text,
        sourceMessageId: sourceId,
        nowIso,
      });
      handlers.persistRequirementPatch(patch);
      handlers.startWorkPlanGeneration();
      return {
        kind: "assistant_reply",
        aiMessage: buildImplementationUserFeedbackAppliedMessage({ patch, envOk: input.envOk }),
        timelineEntries: buildRoutedTimeline(route.classification),
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
