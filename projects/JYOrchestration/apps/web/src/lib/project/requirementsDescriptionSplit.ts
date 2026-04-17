/** 프로젝트 `description`에 요구사항 숙의 메모를 덧붙일 때 사용하는 구분자 */
export const REQUIREMENTS_DELIBERATION_MARKER = "\n\n[요구사항 숙의]\n";

export function splitRequirementsDescription(desc: string | null | undefined): { base: string; deliberation: string } {
  const d = String(desc ?? "");
  const i = d.indexOf(REQUIREMENTS_DELIBERATION_MARKER);
  if (i < 0) return { base: d.trim(), deliberation: "" };
  return {
    base: d.slice(0, i).trim(),
    deliberation: d.slice(i + REQUIREMENTS_DELIBERATION_MARKER.length).trim(),
  };
}

export function joinRequirementsDescription(base: string, deliberation: string): string {
  const b = base.trim();
  const del = deliberation.trim();
  if (!del) return b;
  if (!b) return `${REQUIREMENTS_DELIBERATION_MARKER}${del}`;
  return `${b}${REQUIREMENTS_DELIBERATION_MARKER}${del}`;
}
