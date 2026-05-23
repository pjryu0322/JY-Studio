/** 채팅 메시지에서 드래그한 선택 텍스트를 입력창에 넣기 전 정규화 */
export function normalizeRequirementsChatSelectionText(raw: string): string {
  return String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\d+[\.\)]\s*/, "");
}