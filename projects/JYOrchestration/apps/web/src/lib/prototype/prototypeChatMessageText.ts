import type { PrototypeChatBlock, PrototypeChatBuiltMessage } from "@/lib/prototype/buildPrototypeChatMessages";

function blocksToPlainText(blocks: readonly PrototypeChatBlock[] | undefined): string {
  if (!blocks?.length) return "";
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.kind === "text") lines.push(b.text);
    else if (b.kind === "env_table") {
      for (const r of b.rows) lines.push(`${r.label}: ${r.state}`);
    } else if (b.kind === "ordered_titles") {
      for (const it of b.items) lines.push(`${it.order}. ${it.title}`);
    } else if (b.kind === "pipeline_grid") {
      for (const r of b.rows) lines.push(`${r.label}: ${r.stateKo}`);
    } else if (b.kind === "bullet_list") lines.push(...b.items);
    else if (b.kind === "url_line") lines.push(b.url);
    else if (b.kind === "planner_stage_progress") {
      lines.push(`작업계획 생성 진행 (${b.currentStep}/5)`);
    }
  }
  return lines.join("\n");
}

export function prototypeBuiltMessagePlainText(m: PrototypeChatBuiltMessage): string {
  const parts = [m.title, m.body, blocksToPlainText(m.blocks)].map((s) => String(s ?? "").trim()).filter(Boolean);
  return parts.join("\n\n");
}

export function prototypeReplyPreviewLine(m: PrototypeChatBuiltMessage): string {
  const title = String(m.title ?? "").trim();
  if (title) return `↪ ${title.length > 80 ? `${title.slice(0, 80)}…` : title}`;
  const body = String(m.body ?? "").trim();
  const first = body.split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "";
  if (first) return `↪ ${first.length > 80 ? `${first.slice(0, 80)}…` : first}`;
  return "↪ AI 메시지";
}
