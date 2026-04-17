import type { Project } from "@/components/project-spec/types";
import type { AppFlowGateSnapshot } from "@/lib/workflow/flow-gates";
import { projectHasFeatureBaseline } from "@/lib/workflow/flow-gates";
import { isRequirementsPendingWorkflow } from "@/lib/project/projectWorkflowStatus";

export function buildAppFlowStatusLines(input: {
  effectiveProjectId: string | null;
  project: Project | null;
  taskCount: number;
  gates: AppFlowGateSnapshot;
}): string[] {
  const lines: string[] = [];
  const { effectiveProjectId, project, taskCount, gates } = input;
  if (effectiveProjectId) {
    lines.push(`프로젝트: ${project?.name ?? effectiveProjectId}`);
    if (isRequirementsPendingWorkflow(project?.workflowStatus)) {
      lines.push(
        "요구사항: 아직 단계 미완료 — 협업·실행 계획 등은 요구사항 분석을 마친 뒤 단계 네비게이션에서 열 수 있습니다"
      );
    }
    lines.push(
      projectHasFeatureBaseline(project)
        ? "스펙·실행 계획: 입력됨(작업 단계로 진행 가능)"
        : "스펙·실행 계획: 아직 없음(작업 단계는 스펙 또는 실행 계획이 있어야 합니다)"
    );
    lines.push(`작업 ${taskCount}개 생성됨`);
    lines.push(
      gates.executionEnabled
        ? "실행 환경: 검증 완료(실행 가능)"
        : `실행 환경: 준비 필요${gates.executionReason ? ` — ${gates.executionReason}` : ""}`
    );
  } else {
    lines.push("프로젝트: 아직 선택되지 않음(목록에서 프로젝트를 열면 단계 조건이 표시됩니다)");
  }
  return lines;
}
