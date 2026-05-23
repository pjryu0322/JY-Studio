/** 채팅 입력으로 Pre-Project 대화 → 프로젝트 전환을 요청하는 발화인지 */
export function isMessengerProjectConvertRequest(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (/(AI\s*요약|요약\s*정리|대화\s*요약|요약해\s*줘|회의록처럼\s*정리)/i.test(t) && !/프로젝트/i.test(t)) {
    return false;
  }
  return /(프로젝트(로)?\s*(전환|만들|생성)|현재\s*대화.*프로젝트|대화.*프로젝트(로)?\s*전환|프로토타입\s*준비|초안\s*생성)/i.test(
    t
  );
}
