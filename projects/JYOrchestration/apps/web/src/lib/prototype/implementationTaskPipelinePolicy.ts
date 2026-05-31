type ImplementationBoardStepStatus =
  | "not_started"
  | "ready"
  | "queued"
  | "in_progress"
  | "done"
  | "failed"
  | "skipped";

type ImplementationBoardRoleStep = "developer" | "reviewer" | "security" | "scm";

function isRoleStepComplete(status: ImplementationBoardStepStatus): boolean {
  return status === "done" || status === "skipped";
}

function isRoleStepFailed(status: ImplementationBoardStepStatus): boolean {
  return status === "failed";
}

/** Quick Run Task 단위 파이프라인: AI 개발 + GitHub + 검수까지만. 보안·SCM은 통합 단계에서 수행. */
export function derivePerTaskPipelineRole(input: {
  readonly developerStatus: ImplementationBoardStepStatus;
  readonly reviewerStatus: ImplementationBoardStepStatus;
}): ImplementationBoardRoleStep | "completed" {
  if (isRoleStepFailed(input.developerStatus) || !isRoleStepComplete(input.developerStatus)) {
    return "developer";
  }
  if (isRoleStepFailed(input.reviewerStatus) || !isRoleStepComplete(input.reviewerStatus)) {
    return "reviewer";
  }
  return "completed";
}

export function isPerTaskPipelineComplete(input: {
  readonly developerStatus: ImplementationBoardStepStatus;
  readonly reviewerStatus: ImplementationBoardStepStatus;
}): boolean {
  return derivePerTaskPipelineRole(input) === "completed";
}

export const PER_TASK_PIPELINE_INTEGRATED_FOOTNOTE =
  "보안 점검·SCM merge는 모든 Task 완료 후 통합 단계에서 진행합니다." as const;

export type ImplementationIntegratedPipelineLine = Readonly<{
  readonly stepId: string;
  readonly label: string;
  readonly statusLabel: string;
}>;

export function buildImplementationIntegratedPipelineLines(
  integratedRows: readonly Readonly<{
    readonly step: string;
    readonly title: string;
    readonly status: ImplementationBoardStepStatus;
  }>[],
): readonly ImplementationIntegratedPipelineLine[] {
  return integratedRows.map((row) => ({
    stepId: row.step,
    label: row.title,
    statusLabel: formatIntegratedStepStatusLabel(row.status),
  }));
}

function formatIntegratedStepStatusLabel(status: ImplementationBoardStepStatus): string {
  switch (status) {
    case "done":
      return "완료";
    case "skipped":
      return "건너뜀";
    case "failed":
      return "실패";
    case "in_progress":
      return "진행 중";
    case "queued":
      return "대기열";
    case "ready":
      return "준비";
    default:
      return "대기";
  }
}
