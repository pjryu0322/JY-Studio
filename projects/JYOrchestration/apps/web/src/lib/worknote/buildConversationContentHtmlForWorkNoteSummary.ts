import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

/** 메신저 AI요약 블록 — 재요약 입력에서 제외 */
export function isAiWorkNoteSummaryMessage(m: RequirementsMessage): boolean {
  if (m.meta?.internalType === "ai_work_note_summary") return true;
  const body = String(m.content ?? "").trim();
  return m.role === "ai" && body.startsWith("【AI 요약 정리】");
}

export function shouldIncludeMessageForMessengerSummary(m: RequirementsMessage): boolean {
  if (isAiWorkNoteSummaryMessage(m)) return false;
  const body = String(m.content ?? "").trim();
  if (!body) return false;
  if (m.role === "system" && /AI\s*기획자가\s*메시지에\s*자동으로\s*응답합니다/i.test(body)) return false;
  return true;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * `/api/work-notes/summarize` 입력용 HTML.
 * 요구사항 대화·메신저 대화 등 동일 파이프(`workNoteHtmlToPlainForSummary` → `runWorkNoteSummarizeLlm`)에 쓴다.
 */
export function buildConversationContentHtmlForWorkNoteSummary(
  list: readonly RequirementsMessage[],
  meLabel: string,
  options?: { readonly maxMessages?: number; readonly forMessengerSummary?: boolean }
): string {
  const max = options?.maxMessages ?? 80;
  const label = String(meLabel ?? "").trim() || "나";
  const forMessenger = options?.forMessengerSummary === true;
  const source = forMessenger ? list.filter(shouldIncludeMessageForMessengerSummary) : list;
  const lines: string[] = [];
  lines.push(`<div>`);
  for (const m of source.slice(-max)) {
    const who =
      m.role === "user"
        ? escapeHtml(label)
        : m.role === "ai"
          ? m.speakerName
            ? `AI(${escapeHtml(String(m.speakerName))})`
            : "AI"
          : m.role === "human"
            ? m.speakerName
              ? `멤버(${escapeHtml(String(m.speakerName))})`
              : "멤버"
            : "시스템";
    const body = escapeHtml(String(m.content ?? "").trim());
    lines.push(`<div><strong>${who}</strong>: ${body.replace(/\n/g, "<br/>")}</div>`);
  }
  lines.push(`</div>`);
  return lines.join("\n");
}
