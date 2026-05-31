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
