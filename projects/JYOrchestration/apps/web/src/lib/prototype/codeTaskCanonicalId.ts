import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";

export type ResolveCanonicalCodeTaskResultV1 =
  | Readonly<{ readonly status: "matched"; readonly codeTask: ImplementationCodeTaskV1 }>
  | Readonly<{
      readonly status: "repaired";
      readonly fromCodeTaskId: string;
      readonly toCodeTaskId: string;
      readonly codeTask: ImplementationCodeTaskV1;
      readonly reason: string;
    }>
  | Readonly<{ readonly status: "blocked_mock_id"; readonly codeTaskId: string; readonly reason: string }>
  | Readonly<{ readonly status: "not_found"; readonly codeTaskId: string }>;

const LEGACY_MOCK_CODE_TASK_ID_PREFIX = "CODE-DEV-MOCK-";

export function isLegacyMockCodeTaskId(codeTaskId: string): boolean {
  return String(codeTaskId ?? "")
    .trim()
    .toUpperCase()
    .startsWith(LEGACY_MOCK_CODE_TASK_ID_PREFIX);
}

function isSampleDataRoleTitle(title: string): boolean {
  return /샘플|sample|mock\s*data|fixture|더미/i.test(title);
}

function listDataBranchCodeTasks(codeTasks: readonly ImplementationCodeTaskV1[]): readonly ImplementationCodeTaskV1[] {
  return codeTasks.filter((t) => parseCodeTaskBranchPlanV1(t.branchPlan)?.branchGroup === "data");
}

export function resolveCanonicalCodeTaskForQueuedRun(input: {
  readonly queuedCodeTaskId: string;
  readonly codeTasks: readonly ImplementationCodeTaskV1[];
  readonly currentCodeTaskTitle?: string | null;
  readonly branchGroup?: string | null;
  readonly workBranch?: string | null;
}): ResolveCanonicalCodeTaskResultV1 {
  const queuedId = String(input.queuedCodeTaskId ?? "").trim();
  if (!queuedId) {
    return { status: "not_found", codeTaskId: queuedId };
  }

  const direct = input.codeTasks.find((t) => t.codeTaskId.trim() === queuedId);
  if (direct) {
    return { status: "matched", codeTask: direct };
  }

  if (!isLegacyMockCodeTaskId(queuedId)) {
    return { status: "not_found", codeTaskId: queuedId };
  }

  const dataTasks = listDataBranchCodeTasks(input.codeTasks);
  if (dataTasks.length !== 1) {
    return {
      status: "blocked_mock_id",
      codeTaskId: queuedId,
      reason: dataTasks.length === 0 ? "queued_code_task_id_not_in_current_plan" : "data_branch_not_singleton",
    };
  }

  const canonical = dataTasks[0]!;
  const branchPlan = parseCodeTaskBranchPlanV1(canonical.branchPlan);
  const canonicalWorkBranch = String(branchPlan?.workBranch ?? "").trim();
  const inputWorkBranch = String(input.workBranch ?? "").trim();
  if (inputWorkBranch && canonicalWorkBranch && inputWorkBranch !== canonicalWorkBranch) {
    return {
      status: "blocked_mock_id",
      codeTaskId: queuedId,
      reason: "work_branch_mismatch",
    };
  }
  const inputGroup = String(input.branchGroup ?? "").trim();
  if (inputGroup && inputGroup !== "data") {
    return {
      status: "blocked_mock_id",
      codeTaskId: queuedId,
      reason: "branch_group_mismatch",
    };
  }

  const titleHint = `${canonical.title} ${input.currentCodeTaskTitle ?? ""}`.trim();
  const workBranchOk = /sample-data/i.test(canonicalWorkBranch);
  if (!workBranchOk && !isSampleDataRoleTitle(titleHint)) {
    return {
      status: "blocked_mock_id",
      codeTaskId: queuedId,
      reason: "title_role_mismatch",
    };
  }

  return {
    status: "repaired",
    fromCodeTaskId: queuedId,
    toCodeTaskId: canonical.codeTaskId,
    codeTask: canonical,
    reason: "data_branch_singleton_match",
  };
}

/** production plan에서 legacy mock ID를 canonical data task ID로 치환(충돌 없을 때만). */
export function repairLegacyMockCodeTaskIdsInPlan(
  tasks: readonly ImplementationCodeTaskV1[],
): readonly ImplementationCodeTaskV1[] {
  const dataTasks = listDataBranchCodeTasks(tasks);
  if (dataTasks.length !== 1) return tasks;
  const canonical = dataTasks[0]!;
  const canonicalId = canonical.codeTaskId.trim();
  if (!canonicalId || isLegacyMockCodeTaskId(canonicalId)) return tasks;

  return tasks.map((task) => {
    if (!isLegacyMockCodeTaskId(task.codeTaskId)) return task;
    if (tasks.some((t) => t.codeTaskId.trim() === canonicalId && t !== task)) return task;
    return { ...task, codeTaskId: canonicalId };
  });
}

export function planContainsLegacyMockCodeTaskId(tasks: readonly ImplementationCodeTaskV1[]): boolean {
  return tasks.some((t) => isLegacyMockCodeTaskId(t.codeTaskId));
}
