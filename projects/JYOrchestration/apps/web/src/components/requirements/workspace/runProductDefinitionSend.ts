import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

export async function postProductDefinitionChat(input: Readonly<{
  readonly projectId: string;
  readonly userMessage: string;
  readonly recentTranscript?: string;
}>): Promise<
  | Readonly<{
      readonly ok: true;
      readonly assistantMessage: RequirementsMessage;
      readonly requirementsStateJson: Record<string, unknown>;
      readonly completedPlanning: boolean;
    }>
  | Readonly<{ readonly ok: false; readonly code?: string; readonly message: string }>
> {
  const res = await credentialsIncludeFetch("/api/requirements/product-definition-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      userMessage: input.userMessage,
      recentTranscript: input.recentTranscript,
    }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    code?: string;
    message?: string;
    data?: {
      assistantMessage?: RequirementsMessage;
      requirementsStateJson?: Record<string, unknown>;
      completedPlanning?: boolean;
    };
  };
  if (!res.ok || json.success === false) {
    return { ok: false, code: json.code, message: json.message ?? "Product Definition 요청에 실패했습니다." };
  }
  const assistantMessage = json.data?.assistantMessage;
  const requirementsStateJson = json.data?.requirementsStateJson;
  if (!assistantMessage || !requirementsStateJson) {
    return { ok: false, message: "응답 형식이 올바르지 않습니다." };
  }
  return {
    ok: true,
    assistantMessage,
    requirementsStateJson,
    completedPlanning: Boolean(json.data?.completedPlanning),
  };
}

export function buildProductDefinitionUserMessage(input: Readonly<{
  readonly text: string;
  readonly sessionUserId: string;
  readonly sessionUserName: string;
  readonly nowIso?: string;
}>): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  return newRequirementsMessage({
    role: "user",
    speakerType: "USER",
    speakerId: input.sessionUserId,
    speakerName: input.sessionUserName,
    messageType: "STATEMENT",
    content: input.text.trim(),
    createdAt: now,
  });
}
