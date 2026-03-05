import { normalizeLabel } from "./normalize";

export const LABEL_SYNONYM_GROUPS = {
  성명: ["성명", "이름", "성 명"],
  연락처: ["연락처", "전화", "휴대폰", "연 락 처"],
  주소: ["주소", "거주지", "주 소"],
  부서: ["부서", "소속", "팀", "파트"],
  직위: ["직위", "직급", "직책"],
  입사일: ["입사일", "입사 일자", "입 사 일"],
  사직예정일: ["사직예정일", "퇴사일", "사직 일자"],
  사직사유: ["사직사유", "퇴사사유", "사 유"],
  "E-mail": ["E-mail", "Email", "이메일", "메일"],
  이슈: ["이슈", "문제점", "특이사항"],
  진행현황: ["진행현황", "진행 현황", "현황"],
  차주계획: ["차주계획", "차주 계획", "다음주 계획"],
} as const;

export const LABEL_DICTIONARY = Object.keys(LABEL_SYNONYM_GROUPS) as Array<
  keyof typeof LABEL_SYNONYM_GROUPS
>;

export const SECTION_KEYWORDS = [
  "인적사항",
  "재직사항",
  "사직사항",
  "기본정보",
  "진행현황",
  "회의내용",
] as const;

export const MEETING_KEYWORDS = ["회의", "참석자", "안건", "결정사항"] as const;
export const REPORT_KEYWORDS = ["금주", "차주", "진행현황", "이슈"] as const;

const SYNONYM_LOOKUP = new Map<string, string>();
for (const [canonical, variants] of Object.entries(LABEL_SYNONYM_GROUPS)) {
  SYNONYM_LOOKUP.set(normalizeLabel(canonical), canonical);
  for (const variant of variants) {
    SYNONYM_LOOKUP.set(normalizeLabel(variant), canonical);
  }
}

export function canonicalizeLabel(input: string): string | null {
  const key = normalizeLabel(input);
  return SYNONYM_LOOKUP.get(key) ?? null;
}
