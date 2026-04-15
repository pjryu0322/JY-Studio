import type { RequirementStatus } from "@/lib/mock/workflowMock";
import type { CollaborationTaskDraftStatus, CollaborationTaskDraftType } from "@/lib/workflow/collaborationActionContract";

/** 요구사항·워크플로 목록에 표시되는 상태(내부 코드 → 한글) */
export function formatRequirementStatusForUi(status: RequirementStatus): string {
  switch (status) {
    case "IN_DISCUSSION":
      return "논의 중";
    case "DRAFT":
      return "초안";
    case "APPROVED":
      return "승인됨";
    case "DONE":
      return "완료";
    default: {
      const _e: never = status;
      return _e;
    }
  }
}

export function formatCollaborationSessionStatusForUi(status: "OPEN" | "CLOSED"): string {
  if (status === "OPEN") return "진행 중";
  return "종료";
}

export function formatCollaborationTaskDraftStatusForUi(status: CollaborationTaskDraftStatus): string {
  switch (status) {
    case "DRAFT":
      return "초안";
    case "READY":
      return "준비됨";
    case "BLOCKED":
      return "차단됨";
    default: {
      const _e: never = status;
      return _e;
    }
  }
}

export function formatCollaborationTaskDraftTypeForUi(type: CollaborationTaskDraftType | undefined): string | null {
  if (!type) return null;
  switch (type) {
    case "design":
      return "설계";
    case "backend":
      return "백엔드";
    case "frontend":
      return "프론트엔드";
    case "integration":
      return "통합";
    case "validation":
      return "검증";
    default: {
      const _e: never = type;
      return _e;
    }
  }
}

export function formatFeatureStatusForUi(status: "DRAFT" | "PLANNED" | "IN_PROGRESS" | "DONE"): string {
  switch (status) {
    case "DRAFT":
      return "초안";
    case "PLANNED":
      return "계획됨";
    case "IN_PROGRESS":
      return "진행 중";
    case "DONE":
      return "완료";
    default: {
      const _e: never = status;
      return _e;
    }
  }
}
