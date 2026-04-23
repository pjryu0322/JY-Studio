import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { normalizeRequirementsMessageText } from "@/lib/requirements/requirementsMessageDisplay";

function safeMessageText(m: RequirementsMessage): string {
  const raw = typeof m.content === "string" ? m.content : "";
  return normalizeRequirementsMessageText(raw);
}

function looksLikeAiQuestion(m: RequirementsMessage): boolean {
  if (m.role !== "ai") return false;
  const t = safeMessageText(m);
  if (t.includes("?")) return true;
  if (/\n질문\s*[:：]/.test(t) || /^질문\s*[:：]/m.test(t)) return true;
  if (m.messageType === "QUESTION") return true;
  return false;
}

/**
 * Explicit replyTo wins. Otherwise, walk backward from the latest message and use the
 * nearest AI turn that looks like a question (물음표, "질문:" 블록, 또는 messageType QUESTION).
 * Trailing 사용자 메시지는 건너뛰어, 직전 AI 질문에 대한 후속 답변도 같은 맥락으로 묶습니다.
 */
export function inferRecentAiQuestionReplyParentId(
  messages: readonly RequirementsMessage[],
  explicitReplyTo?: string | null
): string | null {
  const ex = typeof explicitReplyTo === "string" ? explicitReplyTo.trim() : "";
  if (ex) return ex;
  if (!messages.length) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "ai") continue;
    if (looksLikeAiQuestion(m)) return m.id;
  }
  return null;
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
  const clip = safeMessageText(parent).trim().slice(0, 1200);
  const who = parent.speakerName?.trim() || "AI";
  const prefix = `[사용자는 아래 AI 메시지에 이어서 답합니다]\nAI(${who}): ${clip}\n\n---\n`;
  return (prefix + excerpt).slice(-24_000);
}
