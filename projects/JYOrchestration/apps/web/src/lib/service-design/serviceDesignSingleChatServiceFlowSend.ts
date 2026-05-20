import type { ServiceFlowQuickActionDispatch } from "@/components/service-flow/useServiceFlowWorkshopChat";
import { quickActionDispatchFromLegacyLabel } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { ServiceDesignHarnessPayload } from "@/lib/service-design/serviceDesignTurnPayload";

export type InterviewSuggestionPickWire = string | ServiceFlowQuickActionDispatch;

export function storeInterviewSuggestionPick(label: string): InterviewSuggestionPickWire {
  const trimmed = String(label ?? "").trim();
  return quickActionDispatchFromLegacyLabel(trimmed) ?? trimmed;
}

export function interviewSuggestionPickToLabel(
  pick: InterviewSuggestionPickWire | null | undefined,
): string | null {
  if (!pick) return null;
  return typeof pick === "string" ? pick : pick.label;
}

export function interviewSuggestionPickToQuickAction(
  pick: InterviewSuggestionPickWire | null | undefined,
): ServiceFlowQuickActionDispatch | null {
  if (!pick) return null;
  if (typeof pick !== "string") return pick;
  return quickActionDispatchFromLegacyLabel(pick);
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

export type ServiceFlowSingleChatSendOptions = Readonly<{
  /** feature-planning mirror already appended the user turn — skip service-flow duplicate */
  readonly silentUserAppend?: boolean;
}>;

export async function dispatchServiceFlowSingleChatSend(params: {
  readonly payload: ServiceDesignHarnessPayload;
  readonly text: string;
  readonly quickAction?: ServiceFlowQuickActionDispatch | null;
  readonly quickActionLabel?: string | null;
  readonly silentUserAppend?: boolean;
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
  await fn(params.payload, text, quickAction, {
    ...(params.silentUserAppend ? { silentUserAppend: true } : {}),
  });
  params.onAfterDispatch();
  return { dispatched: true };
}

