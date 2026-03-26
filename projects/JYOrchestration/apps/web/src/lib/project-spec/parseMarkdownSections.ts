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

export type ParsedMarkdownToSections = {
  sections: Array<{
    key: string;
    title: string;
    content: string;
  }>;
};

function titleToKey(title: string): string {
  const t = title.trim().toLowerCase();
  return t
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9가-힣_-]/g, "")
    .replace(/_+/g, "_")
    .slice(0, 60);
}

/**
 * AI 응답 마크다운을 "섹션 단위 문서 비교용"으로 정규화한다.
 *
 * - `##`(또는 `#`) 헤더를 title로 사용
 * - 본문은 content로 유지(렌더용)
 * - 헤더가 없던 서문은 title을 `문서 시작`으로 치환
 */
export function parseMarkdownToSections(markdown: string): ParsedMarkdownToSections {
  const secs = parseMarkdownSections(markdown);

  const sections = secs
    .map((s) => {
      const key = sectionKey(s.heading);
      const title = key === MARKDOWN_PREAMBLE_SECTION_KEY ? "문서 시작" : s.heading.trim();
      const normalizedKey = key === MARKDOWN_PREAMBLE_SECTION_KEY ? "preamble" : titleToKey(title);
      const content = (s.body ?? "").trim();
      return { key: normalizedKey, title, content };
    })
    .filter((s) => Boolean(s.content));

  return { sections };
}
