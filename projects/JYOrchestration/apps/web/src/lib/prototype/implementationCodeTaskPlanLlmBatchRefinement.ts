import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

/** Max CodeTasks per LLM batch (inclusive). */
export const CODE_TASK_LLM_BATCH_MAX_SIZE = 10;

/** Target chunk size when splitting a large parent group. */
export const CODE_TASK_LLM_BATCH_TARGET_SIZE = 8;

export type CodeTaskLlmRefinementBatch = Readonly<{
  readonly batchId: string;
  readonly batchIndex: number;
  readonly parentTaskIds: readonly string[];
  readonly codeTaskIds: readonly string[];
  readonly heuristicTasks: readonly ImplementationCodeTaskV1[];
}>;

export type CodeTaskLlmRefinementBatchPlan = Readonly<{
  readonly batches: readonly CodeTaskLlmRefinementBatch[];
  readonly totalCodeTaskCount: number;
}>;

function chunkTasks<T>(items: readonly T[], maxSize: number): T[][] {
  if (items.length <= maxSize) return [items.slice() as T[]];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += maxSize) {
    chunks.push(items.slice(i, i + maxSize) as T[]);
  }
  return chunks;
}

/** Group by parentTaskId; split groups larger than max into 5–10 task batches. */
export function buildCodeTaskLlmRefinementBatchPlan(
  heuristicTasks: readonly ImplementationCodeTaskV1[],
): CodeTaskLlmRefinementBatchPlan {
  const byParent = new Map<string, ImplementationCodeTaskV1[]>();
  for (const task of heuristicTasks) {
    const parentTaskId = String(task.parentTaskId ?? "").trim();
    if (!parentTaskId) continue;
    const list = byParent.get(parentTaskId) ?? [];
    list.push(task);
    byParent.set(parentTaskId, list);
  }

  const sortedParents = [...byParent.keys()].sort();
  const batches: CodeTaskLlmRefinementBatch[] = [];
  let batchIndex = 0;

  for (const parentTaskId of sortedParents) {
    const group = byParent.get(parentTaskId) ?? [];
    const sortedGroup = [...group].sort((a, b) => a.codeTaskId.localeCompare(b.codeTaskId));
    const chunks =
      sortedGroup.length <= CODE_TASK_LLM_BATCH_MAX_SIZE
        ? [sortedGroup]
        : chunkTasks(sortedGroup, CODE_TASK_LLM_BATCH_TARGET_SIZE);

    chunks.forEach((chunk, chunkIndex) => {
      const batchId =
        chunks.length === 1
          ? `parent:${parentTaskId}`
          : `parent:${parentTaskId}:${chunkIndex + 1}`;
      batches.push({
        batchId,
        batchIndex,
        parentTaskIds: [parentTaskId],
        codeTaskIds: chunk.map((t) => t.codeTaskId),
        heuristicTasks: chunk,
      });
      batchIndex += 1;
    });
  }

  return {
    batches,
    totalCodeTaskCount: heuristicTasks.length,
  };
}

function developerTaskById(
  taskList: ImplementationTaskListV1,
): ReadonlyMap<string, ImplementationTaskV1> {
  const map = new Map<string, ImplementationTaskV1>();
  for (const task of taskList.tasks ?? []) {
    if (task.ownerRole !== "developer") continue;
    const taskId = String(task.taskId ?? "").trim();
    if (taskId) map.set(taskId, task);
  }
  return map;
}

export function buildCodeTaskLlmRefinementBatchUserPrompt(input: {
  readonly projectId: string;
  readonly batch: CodeTaskLlmRefinementBatch;
  readonly taskList: ImplementationTaskListV1;
  readonly projectArtifactsSummary?: string;
  readonly implementationSeedSummary?: string;
}): string {
  const devById = developerTaskById(input.taskList);
  const parentSummaries = input.batch.parentTaskIds.map((parentTaskId) => {
    const task = devById.get(parentTaskId);
    if (!task) return { parentTaskId, title: parentTaskId, missing: true };
    return {
      parentTaskId,
      title: task.title,
      taskType: task.taskType,
      description: task.description,
      dependencies: task.dependencies ?? [],
      acceptanceCriteria: task.acceptanceCriteria ?? [],
    };
  });

  return [
    "[implementation code task refinement — batch]",
    `projectId=${input.projectId}`,
    `batchId=${input.batch.batchId}`,
    `batchIndex=${input.batch.batchIndex + 1}`,
    `codeTaskCount=${input.batch.codeTaskIds.length}`,
    "",
    "Refine ONLY the CodeTasks listed below. Do not add or remove codeTaskId values.",
    `Required codeTaskIds: ${input.batch.codeTaskIds.join(", ")}`,
    "",
    "Parent developer tasks for this batch:",
    JSON.stringify(parentSummaries, null, 2),
    "",
    "Heuristic CodeTask draft (this batch only):",
    JSON.stringify(input.batch.heuristicTasks, null, 2),
    "",
    "Implementation seed summary:",
    input.implementationSeedSummary ?? "(none)",
    "",
    "Project artifacts:",
    input.projectArtifactsSummary ?? "(none)",
    "",
    "Tech stack hints:",
    "- Next.js / TypeScript / pnpm monorepo",
    "- Scope: projects/JYOrchestration only",
    "",
    "Output requirements:",
    "- Output JSON only with root object { \"tasks\": [...] }.",
    "- Do not use markdown or ```json fences.",
    "- Return exactly one refined task per codeTaskId listed above.",
    "- Every task must include codeTaskId, parentTaskId, and required fields.",
    "",
    "Return JSON only:",
    `{
  "tasks": [ /* ${input.batch.codeTaskIds.length} tasks */ ]
}`,
  ].join("\n");
}

export type CodeTaskLlmBatchMergeResult = Readonly<{
  readonly mergedTasks: readonly ImplementationCodeTaskV1[];
  readonly llmRefinedTaskCount: number;
  readonly fallbackTaskCount: number;
  readonly llmRefinedBatches: number;
  readonly fallbackBatches: number;
}>;

export function mergeBatchedCodeTaskRefinementResults(input: {
  readonly heuristicTasks: readonly ImplementationCodeTaskV1[];
  readonly batchOutcomes: readonly Readonly<{
    readonly batch: CodeTaskLlmRefinementBatch;
    readonly tasks: readonly ImplementationCodeTaskV1[];
    readonly source: "llm" | "heuristic_fallback";
  }>[];
}): CodeTaskLlmBatchMergeResult {
  const replacementById = new Map<string, ImplementationCodeTaskV1>();
  let llmRefinedBatches = 0;
  let fallbackBatches = 0;

  for (const outcome of input.batchOutcomes) {
    if (outcome.source === "llm") {
      llmRefinedBatches += 1;
      for (const task of outcome.tasks) {
        replacementById.set(task.codeTaskId, task);
      }
    } else {
      fallbackBatches += 1;
      for (const task of outcome.tasks) {
        replacementById.set(task.codeTaskId, task);
      }
    }
  }

  let llmRefinedTaskCount = 0;
  let fallbackTaskCount = 0;
  const mergedTasks = input.heuristicTasks.map((heuristic) => {
    const next = replacementById.get(heuristic.codeTaskId) ?? heuristic;
    if (next.refinementSource === "llm") {
      llmRefinedTaskCount += 1;
    } else {
      fallbackTaskCount += 1;
    }
    return next;
  });

  return {
    mergedTasks,
    llmRefinedTaskCount,
    fallbackTaskCount,
    llmRefinedBatches,
    fallbackBatches,
  };
}

export function buildMergedPlanDraft(input: {
  readonly basePlan: ImplementationCodeTaskPlanV1;
  readonly mergedTasks: readonly ImplementationCodeTaskV1[];
}): ImplementationCodeTaskPlanV1 {
  return {
    ...input.basePlan,
    tasks: input.mergedTasks,
    codeTaskCount: input.mergedTasks.length,
  };
}
