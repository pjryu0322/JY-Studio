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

export async function dispatchServiceFlowSingleChatSend(params: {
  readonly payload: ServiceDesignHarnessPayload;
  readonly text: string;
  readonly quickAction?: ServiceFlowQuickActionDispatch | null;
  readonly quickActionLabel?: string | null;
  readonly sendRefCurrent:
    | ((
        payload: ServiceDesignHarnessPayload,
        text: string,
        quickAction?: ServiceFlowQuickActionDispatch | null,
      ) => void | Promise<void>)
    | null
    | undefined;
  readonly onAfterDispatch: () => void;
}): Promise<{ dispatched: boolean }> {
  if (params.payload.serviceDesignStage !== "service-flow") return { dispatched: false };
  const text = String(params.text ?? "").trim();
  if (!text) return { dispatched: false };
  const fn = params.sendRefCurrent;
  if (!fn) return { dispatched: false };
  const chip = String(params.quickActionLabel ?? "").trim() || null;
  const quickAction =
    params.quickAction ?? (chip ? quickActionDispatchFromLegacyLabel(chip) : null);
  await fn(params.payload, text, quickAction);
  params.onAfterDispatch();
  return { dispatched: true };
}

