/** 채팅 입력으로 Pre-Project AI요약 실행을 요청하는 발화인지 */
export function isMessengerSummaryRequest(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  return /(AI\s*요약|요약\s*정리|대화\s*요약|지금까지\s*정리|요약해\s*줘|회의록처럼\s*정리)/i.test(t);
}

export function formatMessengerAiSummaryBlock(summary: string): string {
  return ["【AI 요약 정리】", "", String(summary ?? "").trim()].join("\n");
}
