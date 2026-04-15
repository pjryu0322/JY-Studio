import type { CollaborationActionResult } from "@/lib/workflow/collaborationActionContract";

export type WorkspaceImpactNote = {
  scope: "primary" | "supporting";
  lines: string[];
};

/** Plain-language summary of what changed in primary vs supporting workspace areas. */
export function getCollaborationWorkspaceImpact(latest: CollaborationActionResult | null): WorkspaceImpactNote | null {
  if (!latest || latest.status !== "success") return null;
  if (latest.actionType === "GENERATE_MINUTES") {
    return {
      scope: "primary",
      lines: [
        "오른쪽 최신 회의록(공식)이 이번 실행 결과를 반영합니다.",
        "분석·아이디어 요청 전까지 보조 인사이트는 그대로입니다.",
      ],
    };
  }
  if (latest.actionType === "GENERATE_FEATURES") {
    return {
      scope: "primary",
      lines: [
        "오른쪽 공식 파생 기능이 이번 실행을 반영합니다(최신 세션 기준 요구사항 기능 탭에서도 확인).",
        "보조 인사이트의 아이디어 제안은 바뀌지 않습니다. 공식 작업 초안은 작업 초안 생성으로 갱신하세요.",
      ],
    };
  }
  if (latest.actionType === "GENERATE_TASKS") {
    return {
      scope: "primary",
      lines: [
        "오른쪽 공식 작업 초안이 이번 실행을 반영합니다(최신 세션 기준 요구사항 작업 탭에서도 확인).",
        "보조 인사이트와 아이디어 제안은 그대로입니다.",
      ],
    };
  }
  if (latest.actionType === "REQUEST_ANALYSIS") {
    return {
      scope: "supporting",
      lines: [
        "보조 인사이트를 열면 새 분석 메모를 볼 수 있습니다.",
        "공식 회의록·파생 기능·작업 초안은 변경되지 않았습니다.",
      ],
    };
  }
  return {
    scope: "supporting",
    lines: [
      "아이디어와 제안 기능 카드가 갱신되었습니다(제안 표기, 공식 아님).",
      "오른쪽 공식 회의록·기능·작업 초안은 그대로입니다.",
    ],
  };
}
