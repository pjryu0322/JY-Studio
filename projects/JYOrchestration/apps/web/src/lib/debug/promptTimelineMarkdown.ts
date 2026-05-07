import type { PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";

function channelLabel(ch: PromptTimelineEntry["channel"]): string {
  return ch === "openai" ? "OpenAI" : "Cursor";
}

/** 디버그 프롬프트 타임라인 API 엔트리 → 마크다운(전체보내기용) */
export function buildDebugPromptTimelineMarkdown(entries: readonly PromptTimelineEntry[]): string {
  const lines: string[] = [];
  lines.push("# 프롬프트 타임라인");
  lines.push("");
  lines.push(`보낸 시각: ${new Date().toISOString()}`);
  lines.push("");
  entries.forEach((e, i) => {
    lines.push(`## ${i + 1}. ${e.label}`);
    lines.push("");
    lines.push(`- **at**: ${e.at}`);
    lines.push(`- **channel**: ${e.channel} (${channelLabel(e.channel)})`);
    if (e.model) lines.push(`- **model**: ${e.model}`);
    if (e.purpose) lines.push(`- **purpose**: ${e.purpose}`);
    if (e.status) lines.push(`- **status**: ${e.status}`);
    if (e.errorMessage) lines.push(`- **errorMessage**: ${e.errorMessage}`);
    if (e.parsedJsonPreview) lines.push(`- **parsedJsonPreview**: ${e.parsedJsonPreview}`);
    if (e.promptMetrics) {
      const m = e.promptMetrics;
      lines.push(
        `- **promptMetrics**: in≈${m.tokenEstimateIn ?? "—"} out≈${m.tokenEstimateOut ?? "—"} · compressedContextSize ${m.compressedContextSize ?? "—"} · topic ${m.topic ?? "—"}`
      );
      if (m.memoryStateSnapshot) lines.push(`  - memory: ${m.memoryStateSnapshot}`);
    }
    lines.push("");
    lines.push(`### 플랫폼 → ${channelLabel(e.channel)}`);
    lines.push("");
    lines.push("```text");
    lines.push((e.outbound ?? "").trim() || "(없음)");
    lines.push("```");
    lines.push("");
    lines.push(`### ${channelLabel(e.channel)} → 플랫폼`);
    lines.push("");
    lines.push("```text");
    lines.push((e.inbound ?? "").trim() || "(없음)");
    lines.push("```");
    lines.push("");
    lines.push("---");
    lines.push("");
  });
  return lines.join("\n");
}

export function downloadDebugPromptTimelineMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

export function sanitizeTimelineExportBasename(id: string): string {
  const s = id.trim().slice(0, 80);
  return s.replace(/[/\\?%*:|"<>]/g, "-") || "project";
}

export function localDateSlug(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
