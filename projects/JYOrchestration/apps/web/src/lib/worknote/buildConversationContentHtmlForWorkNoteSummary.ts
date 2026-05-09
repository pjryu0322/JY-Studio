import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

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
  options?: { readonly maxMessages?: number }
): string {
  const max = options?.maxMessages ?? 80;
  const label = String(meLabel ?? "").trim() || "나";
  const lines: string[] = [];
  lines.push(`<div>`);
  for (const m of list.slice(-max)) {
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
    if (!body) continue;
    lines.push(`<div><strong>${who}</strong>: ${body.replace(/\n/g, "<br/>")}</div>`);
  }
  lines.push(`</div>`);
  return lines.join("\n");
}
