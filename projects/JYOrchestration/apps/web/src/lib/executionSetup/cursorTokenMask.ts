/**
 * UI용 마스크. 전체 키는 일반 API 응답에 포함하지 않으며, 소유자 전용 reveal 엔드포인트로만 일시 표시합니다.
 */
export function maskCursorTokenForUi(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.length <= 8) return "••••••••";
  const last4 = t.slice(-4);
  if (t.startsWith("crsr_")) return `crsr_****${last4}`;
  if (t.startsWith("key_")) return `key_****${last4}`;
  const head = t.slice(0, 4);
  return `${head}****${last4}`;
}
