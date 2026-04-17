import type { AppFlowStepId } from "@/lib/workflow/flow-state";
import type { Project } from "@/components/project-spec/types";
import type { ExecutionSetupDto } from "@/components/project-spec/api";
import { computeProjectExecutionReadiness } from "@/components/project/projectExecutionReadinessModel";
import { isRequirementsPendingWorkflow } from "@/lib/project/projectWorkflowStatus";

/** 확정 스펙 또는 실행 계획 본문이 있으면 이후 단계(작업)로 넘어갈 수 있다고 본다. */
export function projectHasFeatureBaseline(project: Project | null): boolean {
  if (!project) return false;
  const spec = String(project.confirmedSpecMarkdown ?? "").trim();
  const plan = String(project.executionPlanMarkdown ?? "").trim();
  return spec.length > 0 || plan.length > 0;
}

const REQUIREMENTS_GATE_KR = "먼저 요구사항을 확정해야 다음 단계로 진행할 수 있습니다.";

export function computeFlowGates(input: {
  projectId: string | null;
  project: Project | null;
  executionSetup: ExecutionSetupDto | null;
}): {
  collaborationEnabled: boolean;
  featuresEnabled: boolean;
  tasksEnabled: boolean;
  planningEnabled: boolean;
  executionEnabled: boolean;
  traceEnabled: boolean;
  collaborationReason: string | null;
  featuresReason: string | null;
  tasksReason: string | null;
  planningReason: string | null;
  executionReason: string | null;
  traceReason: string | null;
} {
  const hasProject = Boolean(input.projectId);
  const requirementsPending = hasProject && isRequirementsPendingWorkflow(input.project?.workflowStatus);
  const hasBaseline = projectHasFeatureBaseline(input.project);
  const readiness = computeProjectExecutionReadiness(input.executionSetup);

  const collaborationEnabled = !hasProject || !requirementsPending;
  const featuresEnabled = !hasProject || !requirementsPending;
  const tasksEnabled = hasProject && !requirementsPending && hasBaseline;
  const planningEnabled = hasProject && !requirementsPending;
  const executionEnabled = hasProject && !requirementsPending && readiness.runnable;
  const traceEnabled = !hasProject || !requirementsPending;

  return {
    collaborationEnabled,
    featuresEnabled,
    tasksEnabled,
    planningEnabled,
    executionEnabled,
    traceEnabled,
    collaborationReason: collaborationEnabled ? null : REQUIREMENTS_GATE_KR,
    featuresReason: featuresEnabled ? null : REQUIREMENTS_GATE_KR,
    tasksReason: tasksEnabled
      ? null
      : !hasProject
        ? "프로젝트를 선택하면 작업 단계 조건을 확인할 수 있습니다."
        : requirementsPending
          ? REQUIREMENTS_GATE_KR
          : "확정 스펙 또는 실행 계획을 저장한 뒤 작업 단계로 진행할 수 있습니다.",
    planningReason: planningEnabled
      ? null
      : !hasProject
        ? "프로젝트를 선택하면 실행 계획(홈)으로 이동할 수 있습니다."
        : REQUIREMENTS_GATE_KR,
    executionReason: executionEnabled
      ? null
      : !hasProject
        ? "실행 환경은 프로젝트 설정에서 준비합니다."
        : requirementsPending
          ? REQUIREMENTS_GATE_KR
          : readiness.blockedReasonKr ?? "실행 환경을 설정·검증해야 실행 단계로 갈 수 있습니다.",
    traceReason: traceEnabled ? null : REQUIREMENTS_GATE_KR,
  };
}

export function stepReachableInStrip(stepId: AppFlowStepId, gates: ReturnType<typeof computeFlowGates>): boolean {
  if (stepId === "requirements") return true;
  if (stepId === "collaboration") return gates.collaborationEnabled;
  if (stepId === "features") return gates.featuresEnabled;
  if (stepId === "tasks") return gates.tasksEnabled;
  if (stepId === "planning") return gates.planningEnabled;
  if (stepId === "execution") return gates.executionEnabled;
  if (stepId === "trace") return gates.traceEnabled;
  return true;
}

export type AppFlowGateSnapshot = ReturnType<typeof computeFlowGates>;
