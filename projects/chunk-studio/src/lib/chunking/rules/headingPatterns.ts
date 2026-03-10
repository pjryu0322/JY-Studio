export interface HeadingMatch {
  isHeading: boolean;
  level: number;
  normalized: string;
}

const PATTERNS: Array<{ rx: RegExp; level: number }> = [
  { rx: /^제\s*\d+\s*장(\s|$)/, level: 1 },
  { rx: /^제\s*\d+\s*절(\s|$)/, level: 2 },
  { rx: /^제\s*\d+\s*조(\s|$)/, level: 3 },
  { rx: /^\d+\.\d+\.\d+\.\d+/, level: 4 },
  { rx: /^\d+\.\d+\.\d+/, level: 3 },
  { rx: /^\d+\.\d+/, level: 2 },
  { rx: /^\d+[.)]\s+/, level: 2 },
  { rx: /^(가|나|다|라|마)\.\s+/, level: 4 },
  { rx: /^(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩)\s*/, level: 5 },
  { rx: /^\(\d+\)\s+/, level: 5 },
  { rx: /^#{1,6}\s+/, level: 1 },
];

function normalizeHeading(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[ \t]+$/g, "")
    .trim();
}

export function detectHeading(text: string): HeadingMatch {
  const normalized = normalizeHeading(text);
  if (!normalized) {
    return { isHeading: false, level: 0, normalized };
  }

  const markdown = normalized.match(/^(#{1,6})\s+/);
  if (markdown) {
    return {
      isHeading: true,
      level: markdown[1].length,
      normalized: normalized.replace(/^#{1,6}\s+/, "").trim(),
    };
  }

  for (const p of PATTERNS) {
    if (p.rx.test(normalized)) {
      return { isHeading: true, level: p.level, normalized };
    }
  }

  const shortLine = normalized.length <= 42;
  const noEndingPunctuation = !/[.!?;:]$/.test(normalized);
  const hasKeyword = /(개요|목적|범위|요구사항|평가기준|제출서류|일정|산출물)/.test(
    normalized
  );
  if (shortLine && noEndingPunctuation && hasKeyword) {
    return { isHeading: true, level: 3, normalized };
  }

  return { isHeading: false, level: 0, normalized };
}

