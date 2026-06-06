import type { CodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import {
  INTEGRATION_WIRING_CODE_TASK_ID,
  INTEGRATION_WIRING_PROCESS_TASK_TITLE,
  INTEGRATION_WIRING_ROLE_TEXT,
  isIntegrationWiringCodeTask,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";

export const INTEGRATION_SHELL_REUSE_BANNED_PHRASES: readonly string[] = [
  "반응형 3열 workspace shell/container를 구현한다",
  "좌열, 중앙, 우열 패널을 명확한 컴포넌트 단위로 분리한다",
  "좌열에는 회의 파일/참여자 영역을 배치한다",
  "중앙에는 작업 공간과 하단 입력줄을 배치한다",
  "우열에는 결과 패널, 요약본/스크립트 탭, 초안 생성 타임라인을 배치한다",
  "프레임 상단에는 변환 단계 칩 또는 진행 상태 영역을 배치한다",
  "전체 IA, 공통 레이아웃, 컨테이너, 주요 패널 구조를 제공한다",
] as const;

export function integrationRequirementHaystack(task: ImplementationCodeTaskV1): string {
  return [
    task.description,
    ...(task.acceptanceCriteria ?? []),
    ...(task.verificationHints ?? []),
  ].join("\n");
}

export function evaluateIntegrationWiringTaskContent(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly processTaskTitle?: string | null;
}): Readonly<{ readonly ok: boolean; readonly issues: readonly string[] }> {
  if (!isIntegrationWiringCodeTask(input.codeTask)) {
    return { ok: true, issues: [] };
  }
  const issues: string[] = [];
  const processTitle = String(input.processTaskTitle ?? "").trim();
  if (processTitle && processTitle !== INTEGRATION_WIRING_PROCESS_TASK_TITLE) {
    issues.push("integration_task_process_title_invalid");
  }
  if (input.codeTask.codeTaskId !== INTEGRATION_WIRING_CODE_TASK_ID) {
    issues.push("integration_task_id_invalid");
  }
  if (input.codeTask.changeType !== "integration") {
    issues.push("integration_task_change_type_invalid");
  }
  const bp: CodeTaskBranchPlanV1 | undefined = input.codeTask.branchPlan;
  if (bp) {
    if (bp.branchGroup !== "integration") {
      issues.push("integration_task_branch_group_invalid");
    }
    if (bp.executionMode !== "integration_only") {
      issues.push("integration_task_execution_mode_invalid");
    }
    if (bp.baseBranch?.trim() && bp.baseBranch !== "wip/screen/workspace") {
      issues.push("integration_task_base_branch_invalid");
    }
  }

  const hay = integrationRequirementHaystack(input.codeTask);
  const roleText = input.codeTask.description.trim() || INTEGRATION_WIRING_ROLE_TEXT;
  if (
    !/최종 연결|App Shell에 최종 연결/i.test(roleText) &&
    !/최종 연결|App Shell에 최종 연결/i.test(hay)
  ) {
    issues.push("integration_task_role_invalid");
  }
  if (!/import/i.test(hay)) {
    issues.push("integration_task_not_final_wiring");
  }
  if (!/props|wiring/i.test(hay)) {
    issues.push("integration_task_not_final_wiring");
  }
  if (!/Preview/i.test(hay)) {
    issues.push("integration_task_not_final_wiring");
  }
  for (const banned of INTEGRATION_SHELL_REUSE_BANNED_PHRASES) {
    if (hay.includes(banned)) {
      issues.push("integration_task_requirements_reused_shell_task");
      break;
    }
  }
  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}
