/** `@@token` 형태의 멘션에서 AI 식별자 추출 (프로토타입 챗 등 서버·클라이언트 공용). */
export function extractMentionedAI(input: string): string | null {
  const match = input.match(/@@([^\s@]+)/);
  return match ? match[1] : null;
}
