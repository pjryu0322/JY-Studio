import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

export type PrototypeExecutionActivityStatus = Readonly<{
  readonly active: boolean;
  readonly label: string;
  readonly detail?: string;
}>;

const IDLE: PrototypeExecutionActivityStatus = { active: false, label: "" };

const ACTIVE_WIP_STATUSES = new Set<CodeAgentWipExecutionV1["status"]>([
  "requested",
  "drafting",
  "wip_committed",
  "developer_reviewing",
  "refactor_requested",
  "refactoring",
  "wip_updated",
]);

const ACTIVE_BRIDGE_STATUSES = new Set<NonNullable<CodeAgentWipExecutionV1["bridgeExecutionStatus"]>>([
  "bridge_requested",
  "bridge_running",
]);

export function isCodeAgentWipExecutionActive(
  wip: CodeAgentWipExecutionV1 | null | undefined,
): boolean {
  if (!wip) return false;
  if (ACTIVE_WIP_STATUSES.has(wip.status)) return true;
  return wip.bridgeExecutionStatus ? ACTIVE_BRIDGE_STATUSES.has(wip.bridgeExecutionStatus) : false;
}

function resolveWipActivityLabel(wip: CodeAgentWipExecutionV1): PrototypeExecutionActivityStatus {
  if (wip.bridgeExecutionStatus === "bridge_running") {
    return { active: true, label: "Cursor 실행 중", detail: wip.selectedTaskId ? `Task ${wip.selectedTaskId}` : undefined };
  }
  if (wip.bridgeExecutionStatus === "bridge_requested") {
    return { active: true, label: "Cursor 실행 요청 중" };
  }
  if (wip.status === "drafting" || wip.status === "requested") {
    return { active: true, label: "Code Agent WIP 초안 생성 중" };
  }
  if (wip.status === "refactoring" || wip.status === "refactor_requested") {
    return { active: true, label: "Code Agent WIP 재작업 중" };
  }
  if (wip.status === "developer_reviewing") {
    return { active: true, label: "Code Agent WIP 검토 중" };
  }
  return { active: true, label: "Code Agent WIP 작업 진행 중" };
}

export function resolvePrototypeRunActivityLabel(status: PrototypeRun["status"] | null | undefined): string {
  switch (status) {
    case "PLANNER_ANALYZING":
      return "AI 플래너 작업계획 생성 중";
    case "CURSOR_REQUESTED":
      return "Cursor 작업 요청 중";
    case "CURSOR_RUNNING":
      return "Cursor 코드 생성 중";
    case "COMMIT_DETECTED":
      return "Git commit 반영 중";
    case "PUSH_CONFIRMED":
      return "Git push 진행 중";
    case "AI_REVIEWING":
      return "AI 검토 중";
    case "PR_OPENED":
      return "PR 처리 중";
    case "MERGED":
      return "Merge·배포 준비 중";
    case "DEPLOY_CONFIGURING":
      return "GitHub Pages 설정 중";
    case "DEPLOYING":
      return "배포 진행 중";
    case "WORK_UNITS_READY":
      return "WorkUnit 실행 진행 중";
    default:
      return "프로토타입 자동화 진행 중";
  }
}

export function resolvePrototypeExecutionActivityStatus(input: {
  readonly plannerCreatePending: boolean;
  readonly isPlannerRunning: boolean;
  readonly plannerProgressStep?: number;
  readonly isRunningState: boolean;
  readonly latestRunStatus?: PrototypeRun["status"] | null;
  readonly protoBusy: boolean;
  readonly executionEnvLoading: boolean;
  readonly conversationLoading: boolean;
  readonly aiInvokePending: boolean;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
}): PrototypeExecutionActivityStatus {
  if (input.plannerCreatePending) {
    return { active: true, label: "작업계획 생성 요청 중" };
  }
  if (input.isPlannerRunning) {
    const step = input.plannerProgressStep;
    return {
      active: true,
      label: "AI 플래너 작업계획 생성 중",
      detail: step && step >= 1 && step <= 5 ? `${step}/5 단계` : undefined,
    };
  }
  if (input.isRunningState) {
    return {
      active: true,
      label: resolvePrototypeRunActivityLabel(input.latestRunStatus),
    };
  }
  if (input.codeAgentWipExecutionV1 && isCodeAgentWipExecutionActive(input.codeAgentWipExecutionV1)) {
    return resolveWipActivityLabel(input.codeAgentWipExecutionV1);
  }
  if (input.protoBusy) {
    return { active: true, label: "작업 처리 중" };
  }
  if (input.executionEnvLoading) {
    return { active: true, label: "실행 환경 확인 중" };
  }
  if (input.conversationLoading) {
    return { active: true, label: "구현 대화 불러오는 중" };
  }
  if (input.aiInvokePending) {
    return { active: true, label: "AI 개발자 응답 준비 중" };
  }
  return IDLE;
}
