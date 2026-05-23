import type { ServiceFlowQuickActionDispatch } from "@/components/service-flow/useServiceFlowWorkshopChat";
import {
  initialProposalSuggestionPickFromAction,
  isInitialProposalSuggestionPick,
  resolveInitialProposalQuickReplyAction,
  type InitialProposalSuggestionPickWire,
} from "@/lib/requirements/preProjectSingleChatInitialProposal";
import { quickActionDispatchFromLegacyLabel } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { ServiceFlowSubIntent } from "@/lib/requirements/serviceFlowSubIntent";
import {
  resolveProjectSingleChatCtaId,
  type ProjectSingleChatCtaId,
  type ProjectSingleChatStageIntent,
} from "@/lib/requirements/singleChatStageRouter";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";

export type InterviewSuggestionPickWire =
  | string
  | ServiceFlowQuickActionDispatch
  | InitialProposalSuggestionPickWire;

export function storeInterviewSuggestionPick(label: string): InterviewSuggestionPickWire {
  const trimmed = String(label ?? "").trim();
  const proposalAction = resolveInitialProposalQuickReplyAction(trimmed);
  if (proposalAction) return initialProposalSuggestionPickFromAction(proposalAction);
  return quickActionDispatchFromLegacyLabel(trimmed) ?? trimmed;
}

export function interviewSuggestionPickToLabel(
  pick: InterviewSuggestionPickWire | null | undefined,
): string | null {
  if (!pick) return null;
  if (isInitialProposalSuggestionPick(pick)) return pick.label;
  return typeof pick === "string" ? pick : pick.label;
}

export function interviewSuggestionPickToQuickAction(
  pick: InterviewSuggestionPickWire | null | undefined,
): ServiceFlowQuickActionDispatch | null {
  if (!pick) return null;
  if (isInitialProposalSuggestionPick(pick)) return null;
  if (typeof pick !== "string") return pick;
  return quickActionDispatchFromLegacyLabel(pick);
}

export function interviewSuggestionPickToRouterOverrides(
  pick: InterviewSuggestionPickWire | null | undefined,
): Readonly<{
  readonly routerStageIntentOverride: ProjectSingleChatStageIntent;
  readonly routerServiceFlowSubIntentOverride?: ServiceFlowSubIntent;
}> | null {
  if (!isInitialProposalSuggestionPick(pick)) return null;
  return {
    routerStageIntentOverride: pick.stageIntent,
    ...(pick.serviceFlowSubIntent ?
      { routerServiceFlowSubIntentOverride: pick.serviceFlowSubIntent }
    : {}),
  };
}

export function shouldRouteFeaturePlanningSendViaServiceFlowAnalyze(input: {
  readonly text: string;
  readonly quickAction?: ServiceFlowQuickActionDispatch | null;
  readonly quickActionLabel?: string | null;
}): boolean {
  const chip =
    String(input.quickActionLabel ?? "").trim() ||
    String(input.text ?? "").trim() ||
    null;
  const quickAction =
    input.quickAction ?? (chip ? quickActionDispatchFromLegacyLabel(chip) : null);
  return Boolean(quickAction?.id);
}

export type ServiceFlowMessageSendSource =
  | "typed_text"
  | "quick_reply"
  | "cta_button"
  | "manual_editor";

export type ServiceFlowSingleChatSendOptions = Readonly<{
  /** feature-planning mirror already appended the user turn — skip service-flow duplicate */
  readonly silentUserAppend?: boolean;
  readonly source?: ServiceFlowMessageSendSource;
  readonly directCtaId?: ProjectSingleChatCtaId | null;
  /** 초기 제안 quick reply 등 — LLM stageIntent보다 우선 */
  readonly routerStageIntentOverride?: ProjectSingleChatStageIntent;
  readonly routerServiceFlowSubIntentOverride?: ServiceFlowSubIntent;
}>;

export async function dispatchServiceFlowSingleChatSend(params: {
  readonly payload: ServiceDesignHarnessPayload;
  readonly text: string;
  readonly quickAction?: ServiceFlowQuickActionDispatch | null;
  readonly quickActionLabel?: string | null;
  readonly silentUserAppend?: boolean;
  readonly directCtaId?: ProjectSingleChatCtaId | null;
  readonly routerStageIntentOverride?: ProjectSingleChatStageIntent;
  readonly routerServiceFlowSubIntentOverride?: ServiceFlowSubIntent;
  readonly sendRefCurrent:
    | ((
        payload: ServiceDesignHarnessPayload,
        text: string,
        quickAction?: ServiceFlowQuickActionDispatch | null,
        opts?: ServiceFlowSingleChatSendOptions,
      ) => void | Promise<void>)
    | null
    | undefined;
  readonly onAfterDispatch: () => void;
}): Promise<{ dispatched: boolean }> {
  const stage = params.payload.serviceDesignStage;
  const isServiceFlow = stage === "service-flow";
  const isFeaturePlanningOrchestration =
    stage === "feature-planning" &&
    shouldRouteFeaturePlanningSendViaServiceFlowAnalyze({
      text: params.text,
      quickAction: params.quickAction,
      quickActionLabel: params.quickActionLabel,
    });
  if (!isServiceFlow && !isFeaturePlanningOrchestration) return { dispatched: false };
  const text = String(params.text ?? "").trim();
  if (!text) return { dispatched: false };
  const fn = params.sendRefCurrent;
  if (!fn) return { dispatched: false };
  const chip =
    String(params.quickActionLabel ?? "").trim() ||
    text ||
    null;
  const quickAction =
    params.quickAction ?? (chip ? quickActionDispatchFromLegacyLabel(chip) : null);
  const directCtaId =
    params.directCtaId ??
    (quickAction ?
      resolveProjectSingleChatCtaId({
        quickActionId: quickAction.id,
        quickActionLabel: quickAction.label,
        allowUserMessageLegacyCtaMatch: false,
      })
    : null);
  const isExplicitQuickReply = Boolean(quickAction || params.routerStageIntentOverride);
  await fn(params.payload, text, quickAction, {
    ...(params.silentUserAppend ? { silentUserAppend: true } : {}),
    ...(params.routerStageIntentOverride ?
      { routerStageIntentOverride: params.routerStageIntentOverride }
    : {}),
    ...(params.routerServiceFlowSubIntentOverride ?
      { routerServiceFlowSubIntentOverride: params.routerServiceFlowSubIntentOverride }
    : {}),
    source: isExplicitQuickReply ? ("quick_reply" as const) : ("typed_text" as const),
    ...(isExplicitQuickReply && directCtaId ? { directCtaId } : {}),
  });
  params.onAfterDispatch();
  return { dispatched: true };
}

