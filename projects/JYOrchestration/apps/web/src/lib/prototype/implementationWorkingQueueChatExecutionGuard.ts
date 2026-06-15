export const CHAT_EXECUTION_REQUIRES_WORKING_QUEUE_BUTTON_MESSAGE =
  "작업을 실행하려면 작업대기에서 [승인] 버튼을 눌러 주세요. 채팅창에서는 보완요청이나 추가 설명을 입력할 수 있습니다." as const;

const EXECUTION_LIKE_PATTERNS: readonly RegExp[] = [
  /^진행해\.?$/i,
  /^시작해\.?$/i,
  /^부탁해\.?$/i,
  /^실행해\.?$/i,
  /^이대로\s*해\.?$/i,
  /^\d+번만?\s*진행/i,
  /^작업대기\s*승인/i,
  /^승인해\.?$/i,
  /^보류해\.?$/i,
  /^거절해\.?$/i,
];

export function isChatExecutionLikeText(text: string): boolean {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  return EXECUTION_LIKE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isChatBlockedExecutionIntent(intent: string): boolean {
  return intent === "approve_pending_work_queue" || intent === "start_initial_quick_run";
}
