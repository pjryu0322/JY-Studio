/**
 * 기능 정리 AI 말풍선 — 질문 누락 시 보강(서버·클라이언트 공통).
 */
const FALLBACK_QUESTION_BLOCK = "[질문]\n추가하거나 수정할 내용이 있습니까?";

export function ensureFeaturePlanningQuestionSuffix(text: string): string {
  const t = text.trim();
  if (!t) return FALLBACK_QUESTION_BLOCK;
  if (/\[질문\]/i.test(t)) return t;
  if (/\?|？/.test(t)) return t;
  return `${t}\n\n${FALLBACK_QUESTION_BLOCK}`;
}
