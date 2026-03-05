import type { TemplateSchema } from "@/lib/template/schema";

export interface SectionDiffItem {
  sectionId: string;
  title: string;
  oldText: string;
  newText: string;
  similarity: number;
  changeType: "minor change" | "major change" | "unchanged";
}

function getSectionText(fullText: string, title: string, nextTitle?: string): string {
  const source = fullText.replace(/\r\n/g, "\n");
  const start = source.indexOf(title);
  if (start < 0) return "";
  if (!nextTitle) return source.slice(start).trim();
  const end = source.indexOf(nextTitle, start + title.length);
  return (end < 0 ? source.slice(start) : source.slice(start, end)).trim();
}

function similarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (ta.size === 0 && tb.size === 0) return 1;
  const inter = Array.from(ta).filter((token) => tb.has(token)).length;
  const union = new Set([...ta, ...tb]).size || 1;
  return inter / union;
}

export function diffSections(
  docA: string,
  docB: string,
  template: TemplateSchema
): SectionDiffItem[] {
  return template.sections.map((section, idx) => {
    const nextTitle = template.sections[idx + 1]?.title;
    const oldText = getSectionText(docA, section.title, nextTitle);
    const newText = getSectionText(docB, section.title, nextTitle);
    const score = similarity(oldText, newText);
    const changeType =
      score >= 0.92 ? "unchanged" : score >= 0.72 ? "minor change" : "major change";
    return {
      sectionId: section.id,
      title: section.title,
      oldText,
      newText,
      similarity: Number(score.toFixed(3)),
      changeType,
    };
  });
}
