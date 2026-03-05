import { nanoid } from "nanoid";
import type { TemplateSchema } from "@/lib/template/schema";

export interface TemplateAwareChunk {
  id: string;
  type: "section" | "table" | "repeat";
  text: string;
  meta: {
    templateId: string;
    sectionId?: string;
    sectionTitle?: string;
    headerLabels?: string[];
  };
}

function findSectionRange(
  fullText: string,
  title: string,
  nextTitle?: string
): string {
  const src = fullText.replace(/\r\n/g, "\n");
  const start = src.indexOf(title);
  if (start < 0) return "";
  if (!nextTitle) return src.slice(start).trim();
  const next = src.indexOf(nextTitle, start + title.length);
  if (next < 0) return src.slice(start).trim();
  return src.slice(start, next).trim();
}

export function runTemplateAwareChunking(input: {
  text: string;
  template: TemplateSchema;
}): TemplateAwareChunk[] {
  const chunks: TemplateAwareChunk[] = [];
  const sections = input.template.sections;

  for (let i = 0; i < sections.length; i += 1) {
    const curr = sections[i];
    const next = sections[i + 1];
    const sectionText = findSectionRange(input.text, curr.title, next?.title);
    if (!sectionText) continue;
    chunks.push({
      id: nanoid(10),
      type: "section",
      text: sectionText,
      meta: {
        templateId: input.template.templateId,
        sectionId: curr.id,
        sectionTitle: curr.title,
      },
    });
  }

  for (const table of input.template.tables) {
    const headers = table.headerLabels;
    if (headers.length === 0) continue;
    const rowRegex = new RegExp(headers.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*"), "i");
    const lines = input.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const matched = lines.filter((line) => rowRegex.test(line)).slice(0, 30);
    if (matched.length === 0) continue;
    chunks.push({
      id: nanoid(10),
      type: "table",
      text: `[HEADER] ${headers.join(" | ")}\n${matched.join("\n")}`,
      meta: {
        templateId: input.template.templateId,
        sectionId: table.sectionId,
        headerLabels: headers,
      },
    });
  }

  for (const rep of input.template.repeatBlocks) {
    try {
      const regex = new RegExp(rep.pattern, "gm");
      const lines = input.text.split(/\n+/).filter(Boolean);
      const matched = lines.filter((line) => regex.test(line));
      for (const line of matched.slice(0, rep.max ?? 1000)) {
        chunks.push({
          id: nanoid(10),
          type: "repeat",
          text: line.trim(),
          meta: {
            templateId: input.template.templateId,
            sectionId: rep.sectionId,
          },
        });
      }
    } catch {
      // ignore invalid pattern for MVP
    }
  }

  return chunks;
}

