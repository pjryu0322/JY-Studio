import type { ActionForExecution, AiMemberActionExecutor, ExecutorOutput } from "@/lib/ai-member/executors/types";

export const stubExecutor: AiMemberActionExecutor = {
  name: "StubExecutor",
  async execute(action: ActionForExecution): Promise<ExecutorOutput> {
    const target = action.projectMember.displayName ?? action.projectMember.aiAgentKey ?? "AI";
    switch (action.actionType) {
      case "REVIEW_REQUEST":
        return {
          summaryText: `${target}: 변경 3건 중 1건 리팩터링 권고(스텁)`,
          resultPayload: {
            kind: "REVIEW_REQUEST",
            summaryText: `${target} 리뷰 요약(스텁)`,
            issues: [
              { severity: "suggestion", file: "src/example.ts", message: "함수 분리 권장" },
              { severity: "info", file: "README.md", message: "문서 보강 가능" },
            ],
            stub: true,
          },
        };
      case "TASK_DRAFT_REQUEST":
        return {
          summaryText: `${target}: Task 초안 제안(스텁)`,
          resultPayload: {
            kind: "TASK_DRAFT_REQUEST",
            draftTitle: "스텁 후속 Task",
            draftDescription: "AI가 제안한 초안 본문입니다. 승인 후 반영하세요.",
            suggestedPrompt: "// 스텁 프롬프트 초안",
            stub: true,
          },
        };
      case "QA_CHECK_REQUEST":
        return {
          summaryText: `${target}: QA 점검 통과(스텁, 이슈 0건)`,
          resultPayload: {
            kind: "QA_CHECK_REQUEST",
            findings: [],
            recommendations: ["통합 테스트 범위 확대 검토"],
            stub: true,
          },
        };
      case "SUMMARY_REQUEST":
      default:
        return {
          summaryText: `${target}: 실행/태스크 요약(스텁)`,
          resultPayload: {
            kind: "SUMMARY_REQUEST",
            summaryText: "프로젝트 맥락 요약(스텁). 실제 연동 시 LLM 출력으로 대체.",
            stub: true,
          },
        };
    }
  },
};
