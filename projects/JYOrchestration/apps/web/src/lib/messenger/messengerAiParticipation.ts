/**
 * 메신저 대화방 AI 참여 모드 — API·DB(Prisma enum)와 동일한 문자열 값.
 */
export const MESSENGER_AI_PARTICIPATION_MODES = ["NONE", "AUTO", "MENTION_ONLY"] as const;
/** Prisma `MessengerAiParticipationMode`와 동일한 값 */
export type MessengerAiMode = (typeof MESSENGER_AI_PARTICIPATION_MODES)[number];

export function parseMessengerAiMode(raw: unknown): MessengerAiMode | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "NONE" || s === "AUTO" || s === "MENTION_ONLY") return s;
  return null;
}

/** `@@AI기획자` / `@@AI 기획자`(공백 허용) / `@@기획자` */
const RE_AI_PLANNER_MENTION = /@@\s*AI\s*기획자/i;
const RE_PLANNER_SHORT_MENTION = /@@\s*기획자/i;

/** 사용자 메시지에 AI 기획자 멘션이 있는지(텍스트 기준, `@@` 접두사만 인정) */
export function textMentionsMessengerAiPlanner(text: string): boolean {
  const t = String(text ?? "");
  return RE_AI_PLANNER_MENTION.test(t) || RE_PLANNER_SHORT_MENTION.test(t);
}

export function messengerMentionTokensFromText(text: string): readonly string[] {
  const out: string[] = [];
  if (RE_AI_PLANNER_MENTION.test(text)) out.push("@@AI기획자");
  if (RE_PLANNER_SHORT_MENTION.test(text)) out.push("@@기획자");
  return out;
}

export function messengerAiModeShortLabel(mode: MessengerAiMode): string {
  switch (mode) {
    case "NONE":
      return "혼자 메모 중";
    case "AUTO":
      return "AI기획자 자동응답";
    case "MENTION_ONLY":
      return "AI기획자 멘션응답";
    default:
      return "대화";
  }
}

export function messengerAiModeChangeSystemLine(
  mode: MessengerAiMode,
  label = messengerAiModeShortLabel(mode)
): string {
  return `AI기획자 참여 방식이「${label}」로 변경되었습니다.`;
}
