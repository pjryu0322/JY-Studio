import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { evaluateCommonBoundarySpecificity } from "@/lib/prototype/codeTaskCommonBoundaryValidation";
import { planHasIntegrationWiringCodeTask } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import {
  INTEGRATION_WIRING_PROCESS_TASK_TITLE,
  isIntegrationWiringCodeTask,
  listExecutableCodeTasksFromPlan,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { evaluateIntegrationWiringTaskContent } from "@/lib/prototype/integrationWiringContentValidation";
import {
  DEFAULT_BRANCH_PLAN_EXECUTION_ORDER,
  type CodeTaskBranchGroupV1,
} from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskPromptContextV1 } from "@/lib/prototype/codeTaskPromptContext";

export type StageOnePromptPreparationDiagnosticV1 = Readonly<{
  readonly code: string;
  readonly message: string;
  readonly codeTaskId?: string;
}>;

export function codeTaskHasPersistedBranchPlan(codeTask: ImplementationCodeTaskV1): boolean {
  const bp = codeTask.branchPlan;
  return Boolean(
    bp?.branchGroup &&
      bp.workBranch?.trim() &&
      bp.baseBranch?.trim() &&
      bp.executionMode,
  );
}

export function codeTaskHasPersistedFileBoundary(codeTask: ImplementationCodeTaskV1): boolean {
  const boundary = parseCodeTaskFileBoundaryV1(codeTask.fileBoundary);
  if (!boundary) return false;
  const allowed = [...boundary.ownedFiles, ...(boundary.allowedGlobs ?? [])].filter(Boolean);
  const forbidden = [...boundary.forbiddenFiles, ...(boundary.forbiddenGlobs ?? [])].filter(Boolean);
  return allowed.length > 0 && forbidden.length > 0;
}

export function branchGroupSummaryNonEmpty(plan: ImplementationCodeTaskPlanV1): boolean {
  const order = plan.implementationBranchPlanV1?.executionOrder ?? DEFAULT_BRANCH_PLAN_EXECUTION_ORDER;
  return order.some((groupId) =>
    plan.tasks.some((t) => t.branchPlan?.branchGroup === groupId),
  );
}

export function integrationTaskIsLast(plan: ImplementationCodeTaskPlanV1): boolean {
  if (!plan.tasks.length) return false;
  const last = plan.tasks[plan.tasks.length - 1]!;
  return (
    last.branchPlan?.branchGroup === "integration" ||
    last.changeType === "integration" ||
    planHasIntegrationWiringCodeTask([last])
  );
}

export function evaluateStageOnePromptPlanReadiness(input: {
  readonly plan: ImplementationCodeTaskPlanV1;
}): Readonly<{
  readonly ready: boolean;
  readonly blocking: boolean;
  readonly diagnostics: readonly StageOnePromptPreparationDiagnosticV1[];
  readonly branchPlanCount: number;
  readonly fileBoundaryCount: number;
  readonly readyCodeTaskCount: number;
  readonly warningCodeTaskCount: number;
}> {
  const diagnostics: StageOnePromptPreparationDiagnosticV1[] = [];
  let branchPlanCount = 0;
  let fileBoundaryCount = 0;
  let readyCodeTaskCount = 0;
  let warningCodeTaskCount = 0;

  const executable = listExecutableCodeTasksFromPlan(input.plan.tasks);
  const orchestration = input.plan.tasks.find((t) => isIntegrationWiringCodeTask(t)) ?? null;

  for (const ct of executable) {
    const hasBranch = codeTaskHasPersistedBranchPlan(ct);
    const hasBoundary = codeTaskHasPersistedFileBoundary(ct);
    if (hasBranch) branchPlanCount += 1;
    if (hasBoundary) fileBoundaryCount += 1;

    let taskReady = hasBranch && hasBoundary;
    if (taskReady) {
      const common = evaluateCommonBoundarySpecificity({ codeTask: ct });
      if (common.missing.length) {
        taskReady = false;
        for (const issue of common.missing) {
          diagnostics.push({ code: issue, message: issue, codeTaskId: ct.codeTaskId });
        }
      }
    }

    if (taskReady) {
      readyCodeTaskCount += 1;
    } else {
      warningCodeTaskCount += 1;
      if (!hasBranch) {
        diagnostics.push({
          code: "branch_plan_missing",
          message: "branchPlan 누락",
          codeTaskId: ct.codeTaskId,
        });
      }
      if (!hasBoundary) {
        diagnostics.push({
          code: "file_boundary_missing",
          message: "fileBoundary 누락",
          codeTaskId: ct.codeTaskId,
        });
      }
    }
  }

  if (!planHasIntegrationWiringCodeTask(input.plan.tasks)) {
    diagnostics.push({
      code: "integration_task_missing",
      message: "Integration Task 없음",
    });
  } else if (orchestration) {
    const hasBranch = codeTaskHasPersistedBranchPlan(orchestration);
    const hasBoundary = codeTaskHasPersistedFileBoundary(orchestration);
    if (!hasBranch) {
      diagnostics.push({
        code: "branch_plan_missing",
        message: "Integration branchPlan 누락",
        codeTaskId: orchestration.codeTaskId,
      });
    }
    if (!hasBoundary) {
      diagnostics.push({
        code: "file_boundary_missing",
        message: "Integration fileBoundary 누락",
        codeTaskId: orchestration.codeTaskId,
      });
    }
    const content = evaluateIntegrationWiringTaskContent({
      codeTask: orchestration,
      processTaskTitle: INTEGRATION_WIRING_PROCESS_TASK_TITLE,
    });
    if (!content.ok) {
      for (const issue of content.issues) {
        diagnostics.push({ code: issue, message: issue, codeTaskId: orchestration.codeTaskId });
      }
    }
  }
  if (!integrationTaskIsLast(input.plan)) {
    diagnostics.push({
      code: "integration_task_not_last",
      message: "Integration Task가 마지막이 아님",
    });
  }
  if (!branchGroupSummaryNonEmpty(input.plan)) {
    diagnostics.push({
      code: "stage_one_branch_group_summary_empty",
      message: "Branch Group별 CodeTask 목록이 비어 있음",
    });
  }

  const blocking = diagnostics.some((d) =>
    [
      "stage_one_branch_group_summary_empty",
      "integration_task_missing",
      "integration_task_not_last",
      "branch_plan_missing",
      "file_boundary_missing",
      "integration_task_process_title_invalid",
      "integration_task_role_invalid",
      "integration_task_requirements_reused_shell_task",
      "integration_task_not_final_wiring",
      "common_boundary_not_role_specific",
    ].includes(d.code),
  );

  const execLen = executable.length;
  const integrationContentOk =
    orchestration &&
    evaluateIntegrationWiringTaskContent({
      codeTask: orchestration,
      processTaskTitle: INTEGRATION_WIRING_PROCESS_TASK_TITLE,
    }).ok;
  const orchestrationBoundaryOk =
    orchestration &&
    codeTaskHasPersistedBranchPlan(orchestration) &&
    codeTaskHasPersistedFileBoundary(orchestration);

  const allReady =
    execLen > 0 &&
    readyCodeTaskCount === execLen &&
    branchPlanCount === execLen &&
    fileBoundaryCount === execLen &&
    Boolean(orchestration) &&
    Boolean(orchestrationBoundaryOk) &&
    Boolean(integrationContentOk) &&
    planHasIntegrationWiringCodeTask(input.plan.tasks) &&
    integrationTaskIsLast(input.plan) &&
    branchGroupSummaryNonEmpty(input.plan);

  return {
    ready: allReady,
    blocking,
    diagnostics,
    branchPlanCount,
    fileBoundaryCount,
    readyCodeTaskCount,
    warningCodeTaskCount,
  };
}

export function isCodeTaskReadyForDeveloperPrompt(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly promptContext?: CodeTaskPromptContextV1 | null;
}): boolean {
  if (!codeTaskHasPersistedBranchPlan(input.codeTask)) return false;
  if (!codeTaskHasPersistedFileBoundary(input.codeTask)) return false;
  if (input.promptContext && !input.promptContext.quality.ready) {
    const missing = input.promptContext.quality.missing ?? [];
    const blockingMissing = missing.filter(
      (m) =>
        m === "branchPlan" ||
        m === "baseBranch" ||
        m === "fileBoundary" ||
        m === "allowedFiles" ||
        m === "forbiddenFiles",
    );
    if (blockingMissing.length) return false;
  }
  return true;
}

export function groupIdsWithTasksFromPlan(
  plan: ImplementationCodeTaskPlanV1,
): readonly CodeTaskBranchGroupV1[] {
  return DEFAULT_BRANCH_PLAN_EXECUTION_ORDER.filter((g) =>
    plan.tasks.some((t) => t.branchPlan?.branchGroup === g),
  );
}
