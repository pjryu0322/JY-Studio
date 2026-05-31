import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import { isPathAllowedByGlobs } from "@/lib/prototype/targetRepositoryPathGuard";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

function readStringArray(value: readonly string[] | null | undefined): readonly string[] {
  return (value ?? []).map((item) => String(item ?? "").trim()).filter(Boolean);
}

function filterAllowedCandidateFiles(
  files: readonly string[],
  allowedPathGlobs: readonly string[],
): readonly string[] {
  if (!allowedPathGlobs.length) return files;
  return files.filter((file) => {
    const normalized = file.replace(/^dir:/, "").trim();
    if (!normalized || normalized.includes("**")) return true;
    return isPathAllowedByGlobs(normalized, allowedPathGlobs);
  });
}

export function refineCursorWorkItemsForImplementation(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly selectedTaskId: string;
  readonly allowedPathGlobs: readonly string[];
  readonly targetRepository?: ProjectTargetRepository | null;
  readonly nowIso?: string;
}): {
  readonly workItems: readonly CursorWorkItem[];
  readonly blockedWorkItemIds: readonly string[];
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
} {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const selectedTaskId = input.selectedTaskId.trim();
  const validTaskIds = new Set(
    (input.taskList.tasks ?? []).map((task) => String(task.taskId ?? "").trim()).filter(Boolean),
  );
  const allowedPathGlobs = readStringArray(input.allowedPathGlobs);
  const allowedPathHints = allowedPathGlobs.length
    ? allowedPathGlobs
    : readStringArray(input.targetRepository?.allowedPathGlobs);

  const blockedWorkItemIds: string[] = [];
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];
  const refined: CursorWorkItem[] = [];

  for (const item of input.workItems) {
    if (item.taskId !== selectedTaskId) continue;
    if (!validTaskIds.has(item.taskId)) {
      blockedWorkItemIds.push(item.id);
      continue;
    }

    const candidateFiles = filterAllowedCandidateFiles(
      readStringArray(item.candidateFiles),
      allowedPathGlobs,
    );
    const removedCandidateCount =
      readStringArray(item.candidateFiles).length - candidateFiles.length;
    const candidateFileHints = readStringArray(item.candidateFileHints);
    const verificationHints =
      readStringArray(item.verificationHints).length > 0
        ? readStringArray(item.verificationHints)
        : readStringArray(item.testCommands).slice(0, 2);

    const next: CursorWorkItem = {
      ...item,
      ...(candidateFiles.length ? { candidateFiles } : {}),
      ...(candidateFileHints.length ? { candidateFileHints } : {}),
      ...(allowedPathHints.length ? { allowedPathHints: allowedPathHints } : {}),
      verificationHints,
      refinementStatus: "source_refined",
      sourceRefinedAt: nowIso,
    };
    refined.push(next);

    if (removedCandidateCount > 0) {
      timelineEntries.push({
        stage: "implementation",
        action: "implementation_work_item_refined",
        source: "platform",
        responseText: [
          `projectId=${input.projectId.trim()}`,
          `taskId=${item.taskId}`,
          `workItemId=${item.id}`,
          `removedCandidateCount=${removedCandidateCount}`,
        ].join(" "),
        createdAt: nowIso,
        orchestrationTraceGroup: "task_cursor_execution",
      });
    }
  }

  return {
    workItems: refined,
    blockedWorkItemIds,
    timelineEntries,
  };
}

export function buildImplementationWorkItemsDraftCreatedTimelineEntry(input: {
  readonly projectId: string;
  readonly taskCount: number;
  readonly workItemCount: number;
  readonly originStage?: "planning" | "implementation";
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const nowIso = input.nowIso ?? new Date().toISOString();
  return {
    stage: "implementation",
    action: "implementation_work_items_draft_created",
    source: "platform",
    responseText: [
      `projectId=${input.projectId.trim()}`,
      `taskCount=${input.taskCount}`,
      `workItemCount=${input.workItemCount}`,
      `originStage=${input.originStage ?? "planning"}`,
    ].join(" "),
    createdAt: nowIso,
    orchestrationTraceGroup: "task_cursor_execution",
  };
}
