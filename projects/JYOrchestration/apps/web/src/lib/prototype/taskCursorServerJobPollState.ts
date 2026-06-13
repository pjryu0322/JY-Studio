import { findActiveImplementationExecutionJob } from "@/lib/prototype/implementationExecutionJob";
import { parseImplementationExecutionUnitsStateV1 } from "@/lib/prototype/implementationExecutionUnitStore";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

function hasInFlightExecutionUnit(state: RequirementsStateJson | null | undefined): boolean {
  const units = parseImplementationExecutionUnitsStateV1(state?.implementationExecutionUnitsV1)?.units ?? [];
  return units.some((unit) => unit.status === "running" || unit.status === "verifying");
}

/** 로컬 requirements state가 서버 job 폴링·동기화를 추적 중인지 (클라이언트 번들 안전). */
export function shouldSyncTaskCursorServerJobPollState(
  state: RequirementsStateJson | null | undefined,
): boolean {
  if (findActiveImplementationExecutionJob(state?.implementationExecutionJobsV1)) {
    return true;
  }

  const execution = parseTaskCursorExecutionV1(state?.taskCursorExecutionV1);
  if (execution && isInFlightTaskCursorExecution(execution)) return true;

  if (hasInFlightExecutionUnit(state)) return true;

  const quickRun = parseImplementationQuickRunV1(state?.implementationQuickRunV1);
  if (quickRun?.status === "running" || quickRun?.status === "paused") return true;

  return false;
}
