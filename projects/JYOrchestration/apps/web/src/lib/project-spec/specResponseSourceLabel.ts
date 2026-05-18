/** Spec 버전/응답의 sourceType을 UI 라벨로 바꿉니다. */
export function specResponseSourceLabel(sourceType: string): string {
  const m: Record<string, string> = {
    RESPONSE: "응답 확정",
    MERGED_SECTIONS: "섹션 병합",
    MANUAL_EDIT: "직접 수정",
    AI_REFINE: "AI 개선",
    LEGACY_IMPORT: "이전 데이터",
  };
  return m[sourceType] ?? sourceType;
}
