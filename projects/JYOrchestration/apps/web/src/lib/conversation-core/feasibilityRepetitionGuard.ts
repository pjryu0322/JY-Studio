type TranscriptTurn = { readonly role: "user" | "assistant"; readonly content: string };

export const FEASIBILITY_CLOSING_PHRASE_RE =
  /다음에는\s*수집\s*가능성\s*점검\s*항목과\s*판단\s*기준을\s*정리하겠습니다/;

/** system prompt가 고정 마지막 문장을 *권장*하는지 (금지 안내 문구는 제외) */
export function promptPrescribesFeasibilityClosingPhrase(text: string): boolean {
  return /마지막 문장:.*다음에는\s*수집\s*가능성\s*점검\s*항목과\s*판단\s*기준을\s*정리하겠습니다/.test(
    String(text ?? "")
  );
}

export function hasRepeatedFeasibilityClosing(transcript: readonly TranscriptTurn[]): boolean {
  return transcript
    .filter((m) => m.role === "assistant")
    .slice(-3)
    .some((m) => FEASIBILITY_CLOSING_PHRASE_RE.test(String(m.content ?? "")));
}

export function buildFeasibilityRepetitionGuardBlock(transcript: readonly TranscriptTurn[]): string {
  if (!hasRepeatedFeasibilityClosing(transcript)) return "";
  return [
    "[반복 방지]",
    "최근 답변에서 이미 점검 항목 안내를 제공했습니다.",
    "이번 답변은 같은 체크리스트 반복이 아니라, 실제 점검 결과 또는 다음 실행 가능한 조치 중심으로 작성하세요.",
    "「다음에는 수집 가능성 점검 항목과 판단 기준을 정리하겠습니다」와 같은 고정 마지막 문장을 사용하지 마세요.",
  ].join("\n");
}
