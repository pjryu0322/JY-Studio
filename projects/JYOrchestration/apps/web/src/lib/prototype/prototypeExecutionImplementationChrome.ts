import type { WorkspaceConversationInterviewUi } from "@/components/workspace/WorkspaceConversationHubIconRow";

/** 구현 단계 툴바 Hub 행: 슬롯 크롬 없이 빠른 실행만 노출할 때 사용 */
export function buildImplementationToolbarQuickHubUi(
  onQuickExecution: () => void,
): WorkspaceConversationInterviewUi {
  return {
    readinessPercent: 0,
    covered: 0,
    total: 0,
    remainingQuestionsEstimate: 0,
    onForceGeneratePlanNow: onQuickExecution,
  };
}
