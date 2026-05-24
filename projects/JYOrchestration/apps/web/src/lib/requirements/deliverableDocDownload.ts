import { sanitizeConversationExportBasename } from "@/lib/chat/conversationMarkdown";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Word에서 열 수 있는 HTML 기반 .doc 본문 */
export function markdownToWordBodyHtml(markdown: string): string {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      closeList();
      out.push("<p>&nbsp;</p>");
      continue;
    }
    if (t.startsWith("### ")) {
      closeList();
      out.push(`<h3>${escapeHtml(t.slice(4))}</h3>`);
      continue;
    }
    if (t.startsWith("## ")) {
      closeList();
      out.push(`<h2>${escapeHtml(t.slice(3))}</h2>`);
      continue;
    }
    if (t.startsWith("# ")) {
      closeList();
      out.push(`<h1>${escapeHtml(t.slice(2))}</h1>`);
      continue;
    }
    if (t.startsWith("- ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${escapeHtml(t.slice(2))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${escapeHtml(t)}</p>`);
  }

  closeList();
  return out.join("\n");
}

function buildWordDocumentHtml(title: string, bodyHtml: string): string {
  const safeTitle = escapeHtml(title || "기획안");
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; font-size: 11pt; line-height: 1.5; color: #0f172a; }
h1 { font-size: 18pt; margin: 0 0 12pt; }
h2 { font-size: 14pt; margin: 16pt 0 8pt; }
h3 { font-size: 12pt; margin: 12pt 0 6pt; }
p, li { margin: 0 0 6pt; }
ul { margin: 0 0 8pt 18pt; padding: 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function downloadDeliverableMarkdownAsDocFile(input: {
  readonly title: string;
  readonly markdown: string;
  readonly version?: number;
}): void {
  if (typeof document === "undefined") return;
  const title = String(input.title ?? "").trim() || "기획안";
  const stem = sanitizeConversationExportBasename(title);
  const version =
    typeof input.version === "number" && Number.isFinite(input.version) && input.version > 0
      ? `_v${Math.floor(input.version)}`
      : "";
  const filename = `${stem}${version}.doc`;
  const bodyHtml = markdownToWordBodyHtml(input.markdown);
  const wordHtml = buildWordDocumentHtml(title, bodyHtml);
  const blob = new Blob(["\ufeff", wordHtml], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
