import { INTEGRATION_FINAL_WIRING_WORK_BRANCH } from "@/lib/prototype/implementationIntegrationStep";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  INTEGRATION_WIRING_CODE_TASK_ID,
  isIntegrationWiringCodeTask,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";

const INTEGRATION_SOURCE_WORK_BRANCHES = new Set([
  INTEGRATION_FINAL_WIRING_WORK_BRANCH,
  "wip/integration/final-wiring",
]);

export function isIntegrationOrchestrationExecutionUnit(
  unit: Pick<
    ImplementationExecutionUnitV1,
    "codeTaskId" | "title" | "branchGroup" | "workBranch"
  >,
): boolean {
  const codeTaskId = unit.codeTaskId.trim();
  if (codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID) return true;
  if (unit.branchGroup === "integration") return true;
  const branch = String(unit.workBranch ?? "").trim();
  if (branch && INTEGRATION_SOURCE_WORK_BRANCHES.has(branch)) return true;
  return isIntegrationWiringCodeTask({
    codeTaskId: unit.codeTaskId,
    changeType: "unknown",
    title: unit.title,
  });
}

export function isExecutableCodeTaskExecutionUnit(
  unit: Pick<
    ImplementationExecutionUnitV1,
    "codeTaskId" | "title" | "branchGroup" | "workBranch"
  >,
): boolean {
  const codeTaskId = unit.codeTaskId.trim();
  if (!codeTaskId) return false;
  if (isIntegrationOrchestrationExecutionUnit(unit)) return false;
  return Boolean(String(unit.workBranch ?? "").trim() || unit.branchGroup !== "integration");
}

export function isIntegrationOrchestrationWorkBranch(branch: string | null | undefined): boolean {
  const b = String(branch ?? "").trim();
  if (!b) return false;
  return INTEGRATION_SOURCE_WORK_BRANCHES.has(b);
}

export function filterExecutableIntegrationMergeTargets<
  T extends Readonly<{ readonly codeTaskId: string; readonly workBranch?: string | null }>,
>(rows: readonly T[]): readonly T[] {
  return rows.filter((row) => {
    if (
      isIntegrationWiringCodeTask({
        codeTaskId: row.codeTaskId,
        changeType: "unknown",
        title: "",
      })
    ) {
      return false;
    }
    if (isIntegrationOrchestrationWorkBranch(row.workBranch)) return false;
    return true;
  });
}
