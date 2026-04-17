/** 신규 프로젝트 생성 직후 — 실행 계획(/projects/:id) 진입 전 요구사항 단계 강제 */
export const PROJECT_WORKFLOW_REQUIREMENTS_PENDING = "REQUIREMENTS_PENDING" as const;

export type ProjectWorkflowStatus = typeof PROJECT_WORKFLOW_REQUIREMENTS_PENDING | string | null;

export function isRequirementsPendingWorkflow(status: string | null | undefined): boolean {
  return String(status ?? "").trim() === PROJECT_WORKFLOW_REQUIREMENTS_PENDING;
}
