import {
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
  updateCodeTaskExecutionRun,
} from "@/lib/prototype/codeTaskExecutionRun";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { appendPromptTimelineEntries } from "@/lib/prototype/implementationTaskListWipPrep";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";

export async function skipCodeTaskByUser(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly nowIso?: string;
}): Promise<PrototypeExecutionOrchestrationPersistInput> {
  const pid = input.projectId.trim();
  const codeTaskId = input.codeTaskId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  if (!pid || !codeTaskId) {
    throw new Error("projectId and codeTaskId are required");
  }

  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  const runs = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];
  const latest = findLatestRunForCodeTask(runs, codeTaskId);
  if (!latest) {
    throw new Error("execution_record_missing");
  }
  const nextRuns = updateCodeTaskExecutionRun(runs, latest.runId, {
    status: "skipped_by_user",
    completedAt: nowIso,
    failureReason: "skipped_by_user",
    errorMessage: "사용자가 CodeTask를 건너뛰었습니다.",
    nowIso,
  });
  const timelineEntry = buildImplementationExecutionLogTimelineEntry({
    action: "code_task_skipped_by_user",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: { projectId: pid, codeTaskId },
    nowIso,
  });
  const patch: PrototypeExecutionOrchestrationPersistInput = {
    codeTaskExecutionRunsV1: nextRuns,
    promptTimeline: appendPromptTimelineEntries(state.promptTimeline ?? [], [timelineEntry]),
  };
  await persistTaskCursorOrchestrationToProject({ projectId: pid, orchestrationPatch: patch });
  return patch;
}

export async function cancelSelectedQuickRunByUser(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): Promise<void> {
  const pid = input.projectId.trim();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const bundle = await getImplementationRuntimeBundle(pid);
  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  const quickRun = parseImplementationQuickRunV1(state.implementationQuickRunV1);
  const timelineEntry = buildImplementationExecutionLogTimelineEntry({
    action: "selected_quick_run_cancelled_by_user",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: pid,
      jobId: bundle.job?.id ?? undefined,
    },
    nowIso,
  });
  await persistTaskCursorOrchestrationToProject({
    projectId: pid,
    orchestrationPatch: {
      implementationQuickRunV1: quickRun
        ? { ...quickRun, status: "failed", updatedAt: nowIso }
        : undefined,
      promptTimeline: appendPromptTimelineEntries(state.promptTimeline ?? [], [timelineEntry]),
    },
  });
}
