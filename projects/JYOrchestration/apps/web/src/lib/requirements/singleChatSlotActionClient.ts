import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { QuickReplyWire } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { SingleChatSlotActionWire } from "@/lib/requirements/singleChatSlotActionTypes";
import type { SingleChatSlotNextActionDecision } from "@/lib/requirements/singleChatSlotNextAction";

export type SingleChatSlotActionRequestBody = Readonly<{
  readonly projectId: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly userMessage: string;
  readonly slotAction: SingleChatSlotActionWire;
  readonly singleChatOrchestrationV1?: unknown;
  readonly currentFlow?: unknown;
  readonly recentMessages?: string;
}>;

export type SingleChatSlotActionSuccessData = Readonly<{
  readonly assistantMessage: string;
  readonly quickReplies: readonly QuickReplyWire[];
  readonly slotDecision: SingleChatSlotNextActionDecision;
}>;

export type SingleChatSlotActionMeta = Readonly<{
  readonly promptTrace?: unknown;
  readonly requirementsStatePatch?: Partial<RequirementsStateJson>;
}>;

export type SingleChatSlotActionResponse =
  | {
      readonly ok: true;
      readonly status: number;
      readonly data: SingleChatSlotActionSuccessData;
      readonly meta?: SingleChatSlotActionMeta;
    }
  | { readonly ok: false; readonly status: number; readonly json: unknown };

export async function postSingleChatSlotAction(
  body: SingleChatSlotActionRequestBody,
): Promise<SingleChatSlotActionResponse> {
  const res = await fetch("/api/requirements/single-chat-slot-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: SingleChatSlotActionSuccessData;
    meta?: SingleChatSlotActionMeta;
    message?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    return { ok: false, status: res.status, json };
  }
  return { ok: true, status: res.status, data: json.data, meta: json.meta };
}
