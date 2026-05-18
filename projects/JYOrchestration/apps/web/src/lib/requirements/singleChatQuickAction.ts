/** SingleChat 메시지 하단 QuickAction 칩과 오케스트레이션 연동 */

export type SingleChatQuickActionKind = "apply" | "partial_edit" | "alternatives" | "direct" | "defer";

const KNOWN_CHIP_LABELS = ["추천안 적용", "일부 수정", "다른 대안 보기", "직접 입력", "보류"] as const;

export function classifyQuickAction(label: string | null | undefined): SingleChatQuickActionKind | null {
  const s = String(label ?? "").trim();
  if (!s) return null;
  if (s.includes("추천안 적용")) return "apply";
  if (s.includes("일부 수정")) return "partial_edit";
  if (s.includes("다른 대안")) return "alternatives";
  if (s.includes("직접 입력")) return "direct";
  if (s.includes("보류")) return "defer";
  return null;
}

/** decisionAxis / explicit owner 휴리스틱용 — 칩만 보낸 턴은 빈 문자열로 취급해 직전 축을 유지하기 쉽게 한다 */
export function routingUserMessageForHeuristics(rawUser: string, quickLabel: string | null): string {
  const u = String(rawUser ?? "").trim();
  const q = String(quickLabel ?? "").trim();
  const known = new Set<string>([...KNOWN_CHIP_LABELS]);
  if (!u) return "";
  if (known.has(u)) return "";
  if (q && u === q && known.has(q)) return "";
  return u;
}

/** planner·specialist·merge·next-question LLM 입력용 */
export function augmentUserMessageForLlm(rawUser: string, quickLabel: string | null): string {
  const r = String(rawUser ?? "").trim();
  const q = String(quickLabel ?? "").trim();
  if (!q) return r;
  return `[QuickAction 선택]\n- 버튼: ${q}\n---\n${r}`;
}

export function quickActionNextQuestionBlock(kind: SingleChatQuickActionKind | null, label: string | null): string {
  if (!kind) return "";
  const b = String(label ?? "").trim();
  switch (kind) {
    case "apply":
      return `[QuickAction 반영]\n사용자는 "${b || "추천안 적용"}"을(를) 선택했다. [대화 발췌]에서 직전 assistant 메시지의 요약·추천 한 줄을 찾아 그 방향이 확정에 가깝게 반영되었다고 가정하고, 다음 세부 설계 결정으로만 나아가라. 같은 A/B 분기를 다시 묻지 마라.`;
    case "partial_edit":
      return `[QuickAction 반영]\n사용자는 "${b || "일부 수정"}"을(를) 선택했다. 직전 추천을 기본안으로 두고, 수정하고 싶은 지점을 한 가지만 구체적으로 물어라.`;
    case "alternatives":
      return `[QuickAction 반영]\n사용자는 "${b || "다른 대안 보기"}"을(를) 선택했다. 같은 역할 관점에서 이전 턴에 제시한 번호 대안·추천 표현과 겹치지 않는 새로운 대안 2~3개와 새 추천을 제시하라.`;
    case "direct":
      return `[QuickAction 반영]\n사용자는 "${b || "직접 입력"}"을(를) 선택했다. 사용자가 자유 입력으로 적은 내용을 최우선으로 해석·반영하고, 꼭 필요한 확인 1가지만 하라.`;
    case "defer":
      return `[QuickAction 반영]\n사용자는 "${b || "보류"}"을(를) 선택했다. 지금 결정을 강요하지 말고, 나중에 필요한 확인 한 가지만 짧게 제안하라.`;
    default:
      return "";
  }
}
