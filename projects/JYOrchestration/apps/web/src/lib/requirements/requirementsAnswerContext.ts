import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { normalizeRequirementsMessageText } from "@/lib/requirements/requirementsMessageDisplay";

function safeMessageText(m: RequirementsMessage): string {
  const raw = typeof m.content === "string" ? m.content : "";
  return normalizeRequirementsMessageText(raw);
}

/** Prefix excerpt so the model treats the user turn as an answer to the prior AI question. */
export function augmentDialogueExcerptForReplyParent(
  excerpt: string,
  messages: readonly RequirementsMessage[],
  parentId: string | null
): string {
  if (!parentId) return excerpt;
  const parent = messages.find((m) => m.id === parentId);
  if (!parent || parent.role !== "ai") return excerpt;
  const clip = safeMessageText(parent).trim().slice(0, 420);
  const who = parent.speakerName?.trim() || "AI";
  const prefix = `[사용자는 아래 AI 메시지에 이어서 답합니다]\nAI(${who}): ${clip}\n\n---\n`;
  return (prefix + excerpt).slice(-24_000);
}
