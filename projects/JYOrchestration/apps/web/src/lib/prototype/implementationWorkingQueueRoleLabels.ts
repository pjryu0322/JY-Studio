import type {
  ImplementationWorkingQueueItem,
  ImplementationWorkingQueueRole,
  ImplementationWorkingQueueWorkflowStep,
} from "@/lib/prototype/implementationWorkingQueueTypes";
import { DEFAULT_DEVELOPER_WORKFLOW } from "@/lib/prototype/implementationWorkingQueueRoleWorkflow";

export function workingQueueRoleLabelKo(role: ImplementationWorkingQueueRole): string {
  switch (role) {
    case "designer":
      return "디자이너";
    case "developer":
      return "개발자";
    case "reviewer":
      return "검수자";
    case "security":
      return "보안관";
    case "planner":
      return "기획자";
    case "orchestrator":
      return "오케스트레이터";
    default:
      return "AI 멤버";
  }
}

export function workingQueueWorkflowStepLabelKo(step: ImplementationWorkingQueueWorkflowStep): string {
  switch (step.task) {
    case "ux_review":
    case "ui_structure_review":
      return `${workingQueueRoleLabelKo(step.role)} 검토`;
    case "developer_fix":
      return `${workingQueueRoleLabelKo(step.role)} 반영`;
    case "security_review":
      return `${workingQueueRoleLabelKo(step.role)} 검토`;
    case "qa_review":
      return `${workingQueueRoleLabelKo(step.role)} 확인`;
    case "orchestration_summary":
      return `${workingQueueRoleLabelKo(step.role)} 종합`;
    default:
      return workingQueueRoleLabelKo(step.role);
  }
}

export function workingQueueItemWorkflowLabel(item: ImplementationWorkingQueueItem): string {
  const steps = item.reviewWorkflow?.length ? item.reviewWorkflow : DEFAULT_DEVELOPER_WORKFLOW;
  if (!steps.length) return "개발자 반영";
  return steps.map((s) => workingQueueWorkflowStepLabelKo(s)).join(" → ");
}
