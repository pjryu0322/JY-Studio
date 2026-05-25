import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { PrototypeExecutionInterviewSlot } from "@/lib/prototype/prototypeExecutionSingleChatTypes";

export type PrototypeChatTurnResult = Readonly<{
  assistantMessage: string;
  responderLabel?: string;
  advisorSummary?: string;
  finalAuthoritySummary?: string;
  outOfScope?: boolean;
  slotKeyToFill?: string | null;
  slotValue?: string | null;
  nextSlotKey?: string | null;
  nextQuestion?: string | null;
  model?: string | null;
}>;

export async function postPrototypeChatSlots(input: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly templateName: string;
  readonly ideationSummary?: string;
  readonly actorFlowSummary?: string;
}): Promise<{ success: boolean; slots?: PrototypeExecutionInterviewSlot[]; message?: string }> {
  const res = await credentialsIncludeFetch("/api/prototype-chat/slots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { slots?: PrototypeExecutionInterviewSlot[] };
    message?: string;
  };
  if (!json.success) return { success: false, message: json.message };
  return { success: true, slots: json.data?.slots ?? [] };
}

export async function postPrototypeChatTurn(input: {
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly templateName: string;
  readonly userMessage: string;
  readonly envOk: boolean;
  readonly slots: readonly PrototypeExecutionInterviewSlot[];
  readonly answers: Readonly<Record<string, string>>;
  readonly currentSlotKey: string | null;
  readonly mentionedAI?: string | null;
}): Promise<{ success: boolean; data?: PrototypeChatTurnResult; message?: string; code?: string }> {
  const res = await credentialsIncludeFetch("/api/prototype-chat/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      serviceDesignStage: "feature-planning",
    }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: PrototypeChatTurnResult;
    message?: string;
    code?: string;
  };
  if (!json.success) {
    return { success: false, message: json.message, code: json.code };
  }
  return { success: true, data: json.data };
}
