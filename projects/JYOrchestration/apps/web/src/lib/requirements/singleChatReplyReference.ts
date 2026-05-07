import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { normalizeRequirementsMessageText } from "@/lib/requirements/requirementsMessageDisplay";

/** 한 줄 답글 참조용 — 원문 전체가 아닌 질문 스니펫만 */
export function compactReplyQuestionSnippet(content: string, maxLen = 52): string {
  const text = normalizeRequirementsMessageText(content).replace(/\s+/g, " ").trim();
  if (!text) return "";
  const qIdx = text.lastIndexOf("?");
  const slice =
    qIdx >= 0
      ? text.slice(Math.max(0, qIdx - Math.max(24, maxLen - 20)), qIdx + 1).trim()
      : text.slice(0, maxLen);
  const clipped = slice.length > maxLen ? `${slice.slice(0, maxLen - 1)}…` : slice;
  return clipped;
}

/** 메시지 목록 위쪽 한 줄 표시용 */
export function formatSingleChatReplyReferenceLine(parent: RequirementsMessage | null | undefined): string {
  if (!parent) return "↪ 메시지에 답글";
  const name = String(parent.speakerName ?? "").trim() || (parent.role === "ai" ? "AI" : "사용자");
  if (parent.role === "ai") {
    const snip = compactReplyQuestionSnippet(parent.content);
    return snip ? `↪ ${name}: ${snip}` : `↪ ${name} 메시지에 답글`;
  }
  return `↪ ${name} 메시지에 답글`;
}
