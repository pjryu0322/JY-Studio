import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

export const CANONICAL_SAMPLE_DATA_PROCESS_TASK_ID = "DEV-SAMPLE-DATA-001";

export type CanonicalCodeTaskRunTargetV1 = Readonly<{
  readonly taskId: string;
  readonly processTaskId: string;
  readonly codeTaskId: string;
  readonly branchGroup: string;
  readonly baseBranch: string;
  readonly workBranch: string;
  readonly parentTaskId: string;
}>;

export function isLegacyMockProcessTaskId(taskId: string): boolean {
  return /^DEV-MOCK-/i.test(String(taskId ?? "").trim());
}

export function buildCanonicalProcessTaskIdForCodeTask(input: {
  readonly codeTaskId: string;
  readonly branchGroup?: string | null;
  readonly title?: string | null;
}): string {
  const codeTaskId = String(input.codeTaskId ?? "").trim();
  const bg = String(input.branchGroup ?? "").trim();
  if (codeTaskId === CANONICAL_SAMPLE_DATA_CODE_TASK_ID || bg === "data") {
    return CANONICAL_SAMPLE_DATA_PROCESS_TASK_ID;
  }
  const devMatch = codeTaskId.match(/^CODE-(DEV-[A-Z0-9-]+)-\d+$/i);
  if (devMatch?.[1]) return devMatch[1]!.trim();
  return codeTaskId.replace(/^CODE-/, "").replace(/-\d+$/, "") || codeTaskId;
}

export function repairLegacyMockProcessTaskId(input: {
  readonly taskId: string;
  readonly codeTaskId: string;
  readonly branchGroup?: string | null;
}): string {
  const taskId = String(input.taskId ?? "").trim();
  if (!isLegacyMockProcessTaskId(taskId)) return taskId;
  return buildCanonicalProcessTaskIdForCodeTask({
    codeTaskId: input.codeTaskId,
    branchGroup: input.branchGroup,
  });
}

export function resolveCanonicalCodeTaskRunTarget(input: {
  readonly codeTask: ImplementationCodeTaskV1;
}): CanonicalCodeTaskRunTargetV1 | null {
  const branchPlan = parseCodeTaskBranchPlanV1(input.codeTask.branchPlan);
  if (!branchPlan?.workBranch?.trim() || !branchPlan.branchGroup) return null;
  const processTaskId = repairLegacyMockProcessTaskId({
    taskId: input.codeTask.parentTaskId,
    codeTaskId: input.codeTask.codeTaskId,
    branchGroup: branchPlan.branchGroup,
  });
  return {
    taskId: processTaskId,
    processTaskId,
    codeTaskId: input.codeTask.codeTaskId.trim(),
    branchGroup: branchPlan.branchGroup,
    baseBranch: branchPlan.baseBranch.trim(),
    workBranch: branchPlan.workBranch.trim(),
    parentTaskId: processTaskId,
  };
}

export function isRunTargetTupleConsistent(input: {
  readonly taskId: string;
  readonly codeTaskId: string;
  readonly branchGroup?: string | null;
}): boolean {
  const taskId = String(input.taskId ?? "").trim();
  const codeTaskId = String(input.codeTaskId ?? "").trim();
  if (!taskId || !codeTaskId) return false;
  if (isLegacyMockProcessTaskId(taskId) && codeTaskId === CANONICAL_SAMPLE_DATA_CODE_TASK_ID) {
    return false;
  }
  if (isLegacyMockProcessTaskId(taskId) && /CODE-DEV-FRAME/i.test(codeTaskId)) {
    return false;
  }
  return true;
}

export function evaluateWorkBranchRepairForVerify(input: {
  readonly fromBranch: string;
  readonly toBranch: string;
  readonly branchPlanWorkBranch?: string | null;
  readonly branchPlanBaseBranch?: string | null;
  readonly branchGroup?: string | null;
}): Readonly<{ readonly allow: boolean; readonly reason?: string }> {
  const from = String(input.fromBranch ?? "").trim();
  const to = String(input.toBranch ?? "").trim();
  if (!from || !to || from === to) {
    return { allow: false, reason: "no_op" };
  }
  const planWork = String(input.branchPlanWorkBranch ?? "").trim();
  const planBase = String(input.branchPlanBaseBranch ?? "").trim();
  const group = String(input.branchGroup ?? "").trim();

  if (planBase && to === planBase && from !== planBase) {
    return { allow: false, reason: "work_branch_repair_to_base_forbidden" };
  }
  if (group === "data" && /foundation\/app-shell/i.test(to) && /sample-data/i.test(from)) {
    return { allow: false, reason: "cross_code_task_branch_repair_forbidden" };
  }
  if (planWork && to !== planWork) {
    if (/wip\/cursor\//i.test(from) && to === planWork) {
      return { allow: true };
    }
    return { allow: false, reason: "cross_code_task_branch_repair_forbidden" };
  }
  return { allow: true };
}

export function isInvalidVerifyBranchContext(input: {
  readonly baseBranch: string;
  readonly workBranch: string;
}): boolean {
  const base = String(input.baseBranch ?? "").trim();
  const work = String(input.workBranch ?? "").trim();
  return Boolean(base && work && base === work);
}

export function patchCodeTaskExecutionRunWithCanonicalTarget(input: {
  readonly run: CodeTaskExecutionRunV1;
  readonly codeTask: ImplementationCodeTaskV1;
}): CodeTaskExecutionRunV1 {
  const target = resolveCanonicalCodeTaskRunTarget({ codeTask: input.codeTask });
  if (!target) return input.run;
  return {
    ...input.run,
    processTaskId: target.processTaskId,
    workBranch: target.workBranch,
    baseBranch: target.baseBranch,
  };
}

export function shouldDiscardStaleMockProcessRun(input: {
  readonly processTaskId: string;
  readonly codeTaskId: string;
}): boolean {
  if (!isLegacyMockProcessTaskId(input.processTaskId)) return false;
  const codeTaskId = String(input.codeTaskId ?? "").trim();
  if (codeTaskId === CANONICAL_SAMPLE_DATA_CODE_TASK_ID) return false;
  if (/CODE-DEV-FRAME/i.test(codeTaskId)) return true;
  return !isRunTargetTupleConsistent({
    taskId: input.processTaskId,
    codeTaskId,
  });
}
