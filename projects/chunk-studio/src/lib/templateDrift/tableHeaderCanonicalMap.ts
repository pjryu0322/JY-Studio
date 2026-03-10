import { normalizeLabel } from "@/lib/templateAuto/normalize";

const HEADER_CANONICAL_GROUPS: Record<string, string[]> = {
  연락처: ["연락처", "전화번호", "전화", "휴대폰"],
  담당자: ["담당자", "책임자", "담당", "Owner"],
  일정: ["일정", "예정일", "계획일", "기한"],
  상태: ["상태", "진행상태", "처리상태"],
};

const variantToCanonical = new Map<string, string>();
for (const [canonical, variants] of Object.entries(HEADER_CANONICAL_GROUPS)) {
  variantToCanonical.set(normalizeLabel(canonical), canonical);
  for (const variant of variants) {
    variantToCanonical.set(normalizeLabel(variant), canonical);
  }
}

export function canonicalizeTableHeader(header: string): string {
  const key = normalizeLabel(header);
  return variantToCanonical.get(key) ?? header.trim();
}
