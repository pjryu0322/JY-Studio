export const TAGS = {
  CONSTRAINT_MUST: ["하여야", "해야 한다", "반드시", "필수", "must", "required"],
  CONSTRAINT_FORBID: ["금지", "불가", "허용하지 않", "prohibit", "forbidden"],
  DELIVERABLE: ["산출물", "결과물", "납품물", "deliverable"],
  DEADLINE: ["기한", "마감", "일까지", "내까지", "deadline", "due"],
  PENALTY: ["벌점", "위약금", "제재", "패널티", "penalty"],
  EVAL_CRITERIA: ["평가기준", "배점", "가점", "감점", "평가항목", "criteria"],
} as const;

export type ConstraintTag = keyof typeof TAGS;

export interface NormalizedConstraintInfo {
  deadlines?: string[];
  deliverables?: string[];
  evalItems?: Array<{ name: string; score?: number }>;
}

export function extractTags(text: string): string[] {
  const lowered = text.toLowerCase();
  const tags: string[] = [];
  for (const [tag, dict] of Object.entries(TAGS) as Array<[
    ConstraintTag,
    readonly string[],
  ]>) {
    if (dict.some((k) => lowered.includes(k.toLowerCase()))) {
      tags.push(tag);
    }
  }
  return tags;
}

export function hasConstraintTags(tags: string[]): boolean {
  return tags.some((tag) => tag.startsWith("CONSTRAINT_"));
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function normalizeConstraintInfo(text: string): NormalizedConstraintInfo {
  const deadlines: string[] = [];
  const deliverables: string[] = [];
  const evalItems: Array<{ name: string; score?: number }> = [];

  const deadlineMatches = text.match(
    /\d{4}[.-]\d{1,2}[.-]\d{1,2}|\d{1,2}월\s*\d{1,2}일|[^\s,.]{1,20}(?:까지|기한|마감)/g
  );
  if (deadlineMatches) deadlines.push(...deadlineMatches.map((s) => s.trim()));

  const deliverableMatches = text.match(
    /(산출물|제출물|결과물)\s*[:：]\s*([^\n.]+)/g
  );
  if (deliverableMatches) {
    for (const match of deliverableMatches) {
      const listText = match.replace(/^(산출물|제출물|결과물)\s*[:：]\s*/g, "");
      const items = listText
        .split(/[;,/]|및|그리고/)
        .map((s) => s.trim())
        .filter(Boolean);
      deliverables.push(...items);
    }
  }

  const evalMatches = text.match(/([가-힣A-Za-z0-9 _/-]{2,30})\s*[:：]?\s*(\d{1,3})\s*점/g);
  if (evalMatches) {
    for (const item of evalMatches) {
      const m = item.match(/([가-힣A-Za-z0-9 _/-]{2,30})\s*[:：]?\s*(\d{1,3})\s*점/);
      if (!m) continue;
      evalItems.push({ name: m[1].trim(), score: Number(m[2]) });
    }
  }

  return {
    deadlines: uniq(deadlines),
    deliverables: uniq(deliverables),
    evalItems,
  };
}

