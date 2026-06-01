import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { prisma } from "@/lib/prisma";

export function mergeOrchestrationPatchIntoRequirementsState(
  base: unknown,
  patch: PrototypeExecutionOrchestrationPersistInput,
): RequirementsStateJson {
  const parsed = parseRequirementsStateJson(base);
  return mergeRequirementsStateJson(parsed, patch);
}

export async function persistTaskCursorOrchestrationToProject(input: {
  readonly projectId: string;
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
}): Promise<RequirementsStateJson> {
  const projectId = input.projectId.trim();
  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: { requirementsStateJson: true },
  });
  const next = mergeOrchestrationPatchIntoRequirementsState(
    row?.requirementsStateJson ?? {},
    input.orchestrationPatch,
  );
  await prisma.project.update({
    where: { id: projectId },
    data: { requirementsStateJson: next as object },
  });
  return next;
}

export function buildTaskCursorJobOrchestrationSlice(
  state: RequirementsStateJson,
): PrototypeExecutionOrchestrationPersistInput {
  return {
    taskCursorExecutionV1: state.taskCursorExecutionV1 ?? null,
    taskCursorExecutionHistoryV1: state.taskCursorExecutionHistoryV1 ?? null,
    implementationTaskExecutionStateV1: state.implementationTaskExecutionStateV1 ?? null,
    implementationAutoQualityGateV1: state.implementationAutoQualityGateV1 ?? null,
    implementationQuickRunV1: state.implementationQuickRunV1 ?? null,
    promptTimeline: state.promptTimeline ?? null,
    cursorWorkItemsV1: state.cursorWorkItemsV1 ?? null,
  };
}

/** Stable fingerprint for server job poll sync — skips redundant apply/persist loops. */
export function buildTaskCursorJobOrchestrationSyncFingerprint(
  patch: PrototypeExecutionOrchestrationPersistInput,
): string {
  const execution = patch.taskCursorExecutionV1;
  return JSON.stringify({
    cursorRunId: execution?.cursorRunId ?? null,
    status: execution?.status ?? null,
    updatedAt: execution?.updatedAt ?? null,
    bridgeExecutionStatus: execution?.bridgeExecutionStatus ?? null,
    executionUpdatedAt: patch.implementationTaskExecutionStateV1?.updatedAt ?? null,
    executionSummary: patch.implementationTaskExecutionStateV1?.summary ?? null,
    autoQualityGateStatus: patch.implementationAutoQualityGateV1?.status ?? null,
    quickRunStatus: patch.implementationQuickRunV1?.status ?? null,
    quickRunUpdatedAt: patch.implementationQuickRunV1?.updatedAt ?? null,
    cursorWorkItemCount: patch.cursorWorkItemsV1?.length ?? 0,
    promptTimelineLength: patch.promptTimeline?.length ?? 0,
  });
}
