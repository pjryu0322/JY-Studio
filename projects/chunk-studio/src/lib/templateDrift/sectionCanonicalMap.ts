import { normalizeLabel } from "@/lib/templateAuto/normalize";

const SECTION_CANONICAL_GROUPS: Record<string, string[]> = {
  안건: ["안건", "회의 안건", "주요 안건", "논의 안건"],
  결정사항: ["결정사항", "회의 결과", "합의사항", "의결사항"],
  "금주 진행": ["금주 진행", "진행 현황", "이번주 주요 작업", "금주 업무"],
  "차주 계획": ["차주 계획", "다음주 계획", "향후 계획"],
};

const variantToCanonical = new Map<string, string>();
for (const [canonical, variants] of Object.entries(SECTION_CANONICAL_GROUPS)) {
  variantToCanonical.set(normalizeLabel(canonical), canonical);
  for (const variant of variants) {
    variantToCanonical.set(normalizeLabel(variant), canonical);
  }
}

export function canonicalizeSectionTitle(title: string): string {
  const key = normalizeLabel(title);
  return variantToCanonical.get(key) ?? title.trim();
}
