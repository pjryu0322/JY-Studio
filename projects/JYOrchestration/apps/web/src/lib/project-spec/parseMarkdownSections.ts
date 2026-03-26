export type MarkdownSection = {
  heading: string;
  body: string;
};

/**
 * 마크다운 본문을 `## 제목` 기준으로 섹션 분할 (첫 블록은 heading "").
 */
export function parseMarkdownSections(markdown: string): MarkdownSection[] {
  const text = markdown?.trim() ?? "";
  if (!text) {
    return [];
  }
  const lines = text.split("\n");
  const sections: MarkdownSection[] = [];
  let currentHeading = "";
  let bodyLines: string[] = [];

  const flush = () => {
    const body = bodyLines.join("\n").trim();
    if (body || currentHeading) {
      sections.push({ heading: currentHeading, body });
    }
    bodyLines = [];
  };

  for (const line of lines) {
    const hm = /^(#{2,6})\s+(.+)$/.exec(line);
    if (hm) {
      flush();
      currentHeading = hm[2].trim();
    } else {
      bodyLines.push(line);
    }
  }
  flush();
  return sections;
}

/** 빈 `##` 없이 시작하는 본문 블록 */
export const MARKDOWN_PREAMBLE_SECTION_KEY = "__preamble__";

export function sectionKey(heading: string): string {
  return heading.trim() ? heading.trim() : MARKDOWN_PREAMBLE_SECTION_KEY;
}

export function mergeSectionBodiesByHeading(a: MarkdownSection[], b: MarkdownSection[]): string[] {
  const set = new Set<string>();
  for (const s of a) {
    set.add(sectionKey(s.heading));
  }
  for (const s of b) {
    set.add(sectionKey(s.heading));
  }
  return Array.from(set);
}

export function bodyForHeading(sections: MarkdownSection[], key: string): string {
  const found = sections.find((s) => sectionKey(s.heading) === key);
  return found?.body ?? "";
}
