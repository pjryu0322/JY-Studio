import type { AppFlowStepId } from "@/lib/workflow/flow-state";

export type WorkflowStepMeta = {
  readonly stepId: AppFlowStepId;
  readonly label: string;
};

// User-facing primary workflow: keep it minimal.
export const workflowStepMeta: readonly WorkflowStepMeta[] = [
  {
    stepId: "requirements",
    // SingleChat 통합: 서비스 기획 진입점은 하나로 유지한다.
    label: "서비스 기획",
  },
  { stepId: "execution", label: "프로토타입 생성" },
  { stepId: "prototype_review", label: "프로토타입 검토" },
] as const;
