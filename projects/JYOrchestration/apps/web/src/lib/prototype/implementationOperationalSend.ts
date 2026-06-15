import type { PrototypeExecutionOperationalSendResult } from "@/lib/prototype/prototypeExecutionOperationalSendResult";
import type { EffectiveImplementationState, ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import { orchestrateImplementationStageAction } from "@/lib/prototype/implementationStageActionOrchestrator";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import {
  canRouteImplementationIntentThroughStageOrchestrator,
  mapImplementationRouterActionToStageAction,
} from "@/lib/prototype/implementationStageActionRun";
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
import type { ImplementationChatAvailability } from "@/lib/prototype/implementationChatAvailability";
import {
  buildImplementationChatAvailabilityBlockedOperationalResult,
  shouldBlockImplementationSupplementChat,
} from "@/lib/prototype/implementationChatAvailabilityGuard";
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
  buildStatusQueryResult: (intent: ImplementationStatusQueryIntent) => PrototypeExecutionOperationalSendResult | null;
  persistRequirementPatch: (patch: ImplementationUserFeedbackPatchV1) => void;
}>;

export type ImplementationStageActionOrchestratorInput = Readonly<{
  readonly projectId: string;
  readonly effectiveState: EffectiveImplementationState;
  readonly execute: (
    actionId: ImplementationStageActionId,
  ) => ImplementationStageActionRunResult | Promise<ImplementationStageActionRunResult>;
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
  /** When set, stage-action-compatible router results use orchestrateImplementationStageAction. */
  stageActionOrchestrator?: ImplementationStageActionOrchestratorInput;
  readonly chatAvailability?: ImplementationChatAvailability;
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
      return runHandlerWithActionTimeline(handlers, classification, actionId, () => {
        handlers.showToast(
          "援ы쁽 ?곗텧臾?Hub???쒓났?섏? ?딆뒿?덈떎. 湲고쉷(/requirements) ?붾㈃?먯꽌 ?곗텧臾쇱쓣 ?뺤씤??二쇱꽭??",
        );
      });
    case "DIRECT_IMPLEMENTATION_SCOPE_INPUT":
      return runHandlerWithActionTimeline(handlers, classification, actionId, () => {
        handlers.showToast("?꾨옒 ?낅젰???援ы쁽 踰붿쐞쨌?붽뎄?ы빆???곴퀬 ?꾩넚??二쇱꽭??");
        handlers.focusChatInput();
      });
    default:
      return timelineOnlyAfterAction(classification, actionId);
  }
}

async function tryOrchestrateRoutedStageAction(
  route: Awaited<ReturnType<typeof routeImplementationUserInput>>,
  input: ImplementationOperationalSendContext,
): Promise<PrototypeExecutionOperationalSendResult | null> {
  if (!input.stageActionOrchestrator) return null;
  const routerActionId =
    route.kind === "execute_action" || route.kind === "show_status" ? route.actionId : null;
  if (!routerActionId || !canRouteImplementationIntentThroughStageOrchestrator(routerActionId)) {
    return null;
  }
  const stageActionId = mapImplementationRouterActionToStageAction(routerActionId);
  if (!stageActionId) return null;

  const run = await orchestrateImplementationStageAction({
    projectId: input.stageActionOrchestrator.projectId,
    actionId: stageActionId,
    source: "natural_language",
    effectiveState: input.stageActionOrchestrator.effectiveState,
    execute: () => input.stageActionOrchestrator!.execute(stageActionId),
  });
  return { kind: "stage_action_run", run };
}

async function resolveRoutedInput(
  route: Awaited<ReturnType<typeof routeImplementationUserInput>>,
  input: ImplementationOperationalSendContext,
  handlers: ImplementationOperationalSendHandlers,
): Promise<PrototypeExecutionOperationalSendResult | null> {
  switch (route.kind) {
    case "show_status": {
      const orchestrated = await tryOrchestrateRoutedStageAction(route, input);
      if (orchestrated) return orchestrated;
      const statusIntent = implementationStatusQueryFromAction(route.actionId);
      if (statusIntent === "none") return "handled";
      const statusResult = handlers.buildStatusQueryResult(statusIntent);
      if (!statusResult) {
        handlers.appendNotice("?섍꼍 ?뺣낫瑜?遺덈윭?ㅻ뒗 以묒엯?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??");
        return "handled";
      }
      return mergeStatusQueryWithRouteTimeline(statusResult, route.classification);
    }
    case "execute_action": {
      const orchestrated = await tryOrchestrateRoutedStageAction(route, input);
      if (orchestrated) return orchestrated;
      return executeRoutedAction(route.actionId, input, handlers, route.classification);
    }
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
    handlers.appendNotice("?섍꼍 ?뺣낫瑜?遺덈윭?ㅻ뒗 以묒엯?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??");
    return "handled";
  }
  return statusResult;
}

/** Intent router + legacy status fallback. Guards (draft/running/regenerate)???몄텧痢≪뿉??泥섎━. */
export async function resolveImplementationOperationalSend(
  input: ImplementationOperationalSendContext,
  handlers: ImplementationOperationalSendHandlers,
): Promise<PrototypeExecutionOperationalSendResult> {
  if (input.isDraftGenerationComplete) {
    handlers.appendNotice(
      "???붿껌? ?뚯쿂?뚮????ㅼ떆 ?앹꽦?띿쑝濡?吏꾪뻾??二쇱꽭?? ??꾨씪?몄쓽 踰꾪듉???ъ슜?섍굅???ㅽ뻾 ?ㅼ젙?먯꽌 ?ㅼ떆 ?쒖옉?????덉뒿?덈떎.",
    );
    return "handled";
  }

  if (input.isRunningState) {
    handlers.appendNotice("?ㅽ뻾 以묒뿉???묒뾽怨꾪쉷???섏젙?????놁뒿?덈떎. 以묐떒 ???ш퀎?랁븷 ???덉뒿?덈떎.");
    return "handled";
  }

  if (input.text.trim() && shouldBlockImplementationSupplementChat(input.chatAvailability)) {
    const nowIso = new Date().toISOString();
    return buildImplementationChatAvailabilityBlockedOperationalResult({
      availability: input.chatAvailability,
      nowIso,
    });
  }

  const route = await routeImplementationUserInput({
    ...input.routeParams,
    text: input.text,
  });

  const routed = await resolveRoutedInput(route, input, handlers);
  if (routed) return routed;

  const legacyStatus = resolveLegacyStatusQuery(input.text, handlers);
  if (legacyStatus) return legacyStatus;

  return "continue";
}
