/** 클라이언트 전용 — Node API 없음 */
export function isPromptTimelineDebugClient(): boolean {
  return process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ENABLE_PROMPT_TIMELINE === "1";
}
