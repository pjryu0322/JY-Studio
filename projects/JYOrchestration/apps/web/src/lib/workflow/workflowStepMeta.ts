import type { AppFlowStepId } from "@/lib/workflow/flow-state";

/** 상단 워크플로 탭 줄 전체(단계 라벨은 `workflowStepMeta` 각 항목). */
export const WORKFLOW_NAV_STRIP_SCREEN_LABEL = "공통-상단내비-워크플로우" as const;

export type WorkflowStepMeta = {
  readonly stepId: AppFlowStepId;
  readonly label: string;
  readonly screenLabel: string;
};

// User-facing primary workflow: keep it minimal.
export const workflowStepMeta: readonly WorkflowStepMeta[] = [
  {
    stepId: "requirements",
    // SingleChat 통합: 서비스 기획 진입점은 하나로 유지한다.
    label: "서비스 기획",
    screenLabel: "공통-상단내비-워크플로우-요구사항",
  },
  { stepId: "execution", label: "프로토타입 생성", screenLabel: "공통-상단내비-워크플로우-실행" },
  { stepId: "prototype_review", label: "프로토타입 검토", screenLabel: "공통-상단내비-워크플로우-프로토타입검토" },
] as const;

/** `FlowProgressStrip` 등 — 상단 탭에 없는 단계는 null */
export function workflowStepScreenLabel(stepId: AppFlowStepId): string | null {
  return workflowStepMeta.find((x) => x.stepId === stepId)?.screenLabel ?? null;
}

