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

const REQUIREMENTS_GATE_KR = "먼저 아이디어 구체화를 마쳐야 다음 단계로 진행할 수 있습니다.";

export function computeFlowGates(input: {
  projectId: string | null;
  project: Project | null;
  executionSetup: ExecutionSetupDto | null;
}): {
  featuresEnabled: boolean;
  tasksEnabled: boolean;
  planningEnabled: boolean;
  executionEnabled: boolean;
  prototypeReviewEnabled: boolean;
  traceEnabled: boolean;
  featuresReason: string | null;
  tasksReason: string | null;
  planningReason: string | null;
  executionReason: string | null;
  prototypeReviewReason: string | null;
  traceReason: string | null;
} {
  const hasProject = Boolean(input.projectId);
  const requirementsPending = hasProject && isRequirementsPendingWorkflow(input.project?.workflowStatus);
  const hasBaseline = projectHasFeatureBaseline(input.project);
  const readiness = computeProjectExecutionReadiness(input.executionSetup);

  const featuresEnabled = !hasProject || !requirementsPending;
  const tasksEnabled = hasProject && !requirementsPending && hasBaseline;
  const planningEnabled = hasProject && !requirementsPending;
  const executionEnabled = hasProject && !requirementsPending && readiness.runnable;
  /** 프리뷰·대화 검토는 프로젝트만 있으면 열 수 있음(실행 환경과 동일한 게이트는 피함). */
  const prototypeReviewEnabled = hasProject && !requirementsPending;
  const traceEnabled = !hasProject || !requirementsPending;

  return {
    featuresEnabled,
    tasksEnabled,
    planningEnabled,
    executionEnabled,
    prototypeReviewEnabled,
    traceEnabled,
    featuresReason: featuresEnabled ? null : REQUIREMENTS_GATE_KR,
    tasksReason: tasksEnabled
      ? null
      : !hasProject
        ? "프로젝트를 선택하면 작업 정리 단계 조건을 확인할 수 있습니다."
        : requirementsPending
          ? REQUIREMENTS_GATE_KR
          : "확정 스펙 또는 생성 준비 내용을 저장한 뒤 작업 정리 단계로 진행할 수 있습니다.",
    planningReason: planningEnabled
      ? null
      : !hasProject
        ? "프로젝트를 선택하면 생성 준비(프로젝트 허브)로 이동할 수 있습니다."
        : REQUIREMENTS_GATE_KR,
    executionReason: executionEnabled
      ? null
      : !hasProject
        ? "프로토타입 생성 환경은 프로젝트 설정에서 준비합니다."
        : requirementsPending
          ? REQUIREMENTS_GATE_KR
          : readiness.blockedReasonKr ?? "실행 환경을 설정·검증해야 프로토타입 생성 단계로 갈 수 있습니다.",
    prototypeReviewReason: prototypeReviewEnabled
      ? null
      : !hasProject
        ? "프로젝트를 선택하면 프로토타입 검토 화면으로 이동할 수 있습니다."
        : REQUIREMENTS_GATE_KR,
    traceReason: traceEnabled ? null : REQUIREMENTS_GATE_KR,
  };
}

export function stepReachableInStrip(stepId: AppFlowStepId, gates: ReturnType<typeof computeFlowGates>): boolean {
  if (stepId === "requirements") return true;
  if (stepId === "service_flow") return true;
  if (stepId === "features") return gates.featuresEnabled;
  if (stepId === "tasks") return gates.tasksEnabled;
  if (stepId === "planning") return gates.planningEnabled;
  if (stepId === "execution") return gates.executionEnabled;
  if (stepId === "prototype_review") return gates.prototypeReviewEnabled;
  if (stepId === "trace") return gates.traceEnabled;
  return true;
}

export type AppFlowGateSnapshot = ReturnType<typeof computeFlowGates>;
