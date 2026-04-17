/**
 * 서버 AI 파이프라인과 분리된, 클라이언트 측 초안 제안(즉시 반응).
 * 사용자가 다듬은 뒤 저장·확정하면 됩니다.
 */
export function buildLocalStructuredDraftFromIdea(idea: string): {
  specCoreGoals: string;
  specScopeIn: string;
  specScopeOut: string;
  specTargetUsers: string;
  specSuccessCriteria: string;
} {
  const core = idea.trim();
  const oneLine = core.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] ?? "";
  return {
    specCoreGoals: core || "여기에 만들고 싶은 것을 자유롭게 적어 주세요.",
    specScopeIn: [
      "[핵심 기능]",
      oneLine ? `• ${oneLine}에 필요한 주요 화면·흐름을 이어서 적어 주세요.` : "• 로그인/목록/상세 등 꼭 필요한 화면을 적어 주세요.",
      "• 데이터를 어디에 저장할지(예: 클라우드 DB)를 적어 주세요.",
    ].join("\n"),
    specScopeOut: [
      "[이번에 하지 않을 것]",
      "• 결제·정산",
      "• 모바일 네이티브 앱(필요 시 여기서 제외한다고 명시)",
      "• (없으면 '없음'으로 적어도 됩니다)",
    ].join("\n"),
    specTargetUsers: [
      "[주요 사용자]",
      "• (예) 내부 운영팀 / 외부 고객 / 관리자 — 누가 주로 쓰나요?",
      "• 어떤 상황에서 가장 자주 쓰나요?",
    ].join("\n"),
    specSuccessCriteria: [
      "[성공 기준]",
      "• (예) 핵심 시나리오 1건을 5분 안에 끝낼 수 있다",
      "• (예) 첫 주에 실사용 피드백 n건을 받는다",
    ].join("\n"),
  };
}
