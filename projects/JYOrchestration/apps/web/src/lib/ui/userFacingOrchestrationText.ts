/**
 * 사용자-facing 오케스트레이션 문구 정제 — 추천 패널·채팅 요약·산출물 설명 공통.
 * Harness explainability debug는 별도 경로에서 내부 메타를 의도적으로 노출할 수 있다.
 */

export const INTERNAL_ORCHESTRATION_TEXT_PATTERNS: readonly RegExp[] = [
  /맥락\s*예산/i,
  /압축\s*정책/i,
  /조립\s*계획/i,
  /참조\s*맥락\s*후보/i,
  /우선순위\s*정리/i,
  /contextBudget/i,
  /compressionPolicy/i,
  /promptAssembly/i,
  /rawPrompt/i,
  /\btoken\b/i,
  /provider\s*latency/i,
  /지식팩\s*활성화\s*힌트/i,
];

export function isInternalOrchestrationUserText(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return true;
  return INTERNAL_ORCHESTRATION_TEXT_PATTERNS.some((re) => re.test(t));
}

export function sanitizeUserFacingOrchestrationText(
  text: string | undefined | null,
  maxLen = 320,
): string {
  const raw = String(text ?? "").trim();
  if (!raw || isInternalOrchestrationUserText(raw)) return "";
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !isInternalOrchestrationUserText(l));
  const joined = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!joined) return "";
  return joined.length > maxLen ? `${joined.slice(0, maxLen)}…` : joined;
}
