/** `RequirementsMessage.meta.internalType` — 아이디어 구체화 자동 인터뷰 시작 메시지 식별용 */
export const IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE = "ideation-interview-bootstrap" as const;

/**
 * 모델이 설명문을 섞어도 UI/저장은 질문 한 덩어리만 쓰도록 정리합니다.
 * - 첫 `?`까지 한 문장만 사용
 * - 물음표 없으면 문장 끝에 `?` 추가(최대 길이 제한)
 */
export function sanitizeIdeationInterviewFirstQuestion(raw: string): string {
  let t = String(raw ?? "").trim();
  if (!t) return "핵심 사용자는 누구이며, 어떤 상황에서 이 서비스가 필요하나요?";
  t = t.replace(/^["'`“”]+|["'`“”]+$/g, "");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "");
  const lines = t
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const line of lines) {
    const q = line.indexOf("?");
    if (q >= 0) {
      const one = line.slice(0, q + 1).trim();
      return one.length > 240 ? `${one.slice(0, 237)}…?` : one;
    }
  }
  const first = lines[0] ?? t;
  const clipped = first.length > 220 ? `${first.slice(0, 217)}…` : first;
  return clipped.endsWith("?") ? clipped : `${clipped}?`;
}
