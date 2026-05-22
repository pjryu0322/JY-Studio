import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export function formatConversationSpeakerLabel(m: RequirementsMessage, meLabel: string): string {
  if (m.role === "user") return meLabel;
  if (m.role === "ai") return m.speakerName ? `AI(${m.speakerName})` : "AI";
  if (m.role === "human") return m.speakerName ? `멤버(${m.speakerName})` : "멤버";
  return "시스템";
}

export function buildConversationMarkdown(input: {
  readonly heading: string;
  readonly scopeLines?: readonly string[];
  readonly messages: readonly RequirementsMessage[];
  readonly meLabel?: string;
}): string {
  const meLabel = String(input.meLabel ?? "").trim() || "나";
  const lines: string[] = [input.heading, ""];
  for (const row of input.scopeLines ?? []) {
    const t = String(row ?? "").trim();
    if (t) lines.push(t);
  }
  if ((input.scopeLines ?? []).length) lines.push("");
  for (const m of input.messages) {
    const who = formatConversationSpeakerLabel(m, meLabel);
    lines.push(`## ${who} · ${new Date(m.createdAt).toISOString()}`);
    lines.push("");
    lines.push(String(m.content ?? "").trim() || "(빈 메시지)");
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

export function sanitizeConversationExportBasename(raw: string): string {
  const t = String(raw ?? "")
    .trim()
    .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
    .replace(/\s+/g, "_")
    .slice(0, 48);
  return t || "conversation";
}

export function downloadConversationMarkdownFile(input: { readonly markdown: string; readonly filenameStem: string }): void {
  if (typeof document === "undefined") return;
  const md = input.markdown;
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stem = sanitizeConversationExportBasename(input.filenameStem);
  a.download = `${stem}_conversation.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function confirmResetConversation(input?: { readonly message?: string }): boolean {
  if (typeof window === "undefined") return false;
  const message =
    input?.message?.trim() ||
    "대화 내역을 모두 삭제하고 다시 시작할까요? 이 작업은 되돌릴 수 없습니다.";
  return window.confirm(message);
}
