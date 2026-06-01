import { createHash } from "node:crypto";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export type ImplementationCodeTaskPlanLlmUsage = Readonly<{
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
  readonly model?: string;
}>;

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function buildSourceTaskListFingerprint(
  taskList: ImplementationTaskListV1 | null | undefined,
): string {
  const developerTasks = (taskList?.tasks ?? [])
    .filter((task) => task.ownerRole === "developer")
    .map((task) => ({
      taskId: task.taskId,
      title: task.title,
      taskType: task.taskType,
      dependencies: task.dependencies ?? [],
      acceptanceCriteria: task.acceptanceCriteria ?? [],
    }));
  return sha256Hex(JSON.stringify(developerTasks));
}

export function buildSourceSeedFingerprint(seed: ImplementationSeedV1 | null | undefined): string {
  if (!seed) return sha256Hex("(none)");
  return sha256Hex(
    JSON.stringify({
      lifecycleStatus: seed.lifecycleStatus,
      processItems: seed.processImplementationItems.length,
      screenItems: seed.screenImplementationItems.length,
      entities: seed.dataModelSeed.entities,
    }),
  );
}

export function buildLlmPromptFingerprint(prompt: string): string {
  return sha256Hex(prompt);
}

export function buildLlmResultFingerprint(text: string): string {
  return sha256Hex(text);
}

export function attachCodeTaskPlanRefinementMeta(input: {
  readonly plan: ImplementationCodeTaskPlanV1;
  readonly sourceTaskListFingerprint?: string;
  readonly sourceSeedFingerprint?: string;
  readonly llmPromptFingerprint?: string;
  readonly llmResultFingerprint?: string;
  readonly refinementRequestedAt?: string;
  readonly refinementCompletedAt?: string;
  readonly llmUsage?: ImplementationCodeTaskPlanLlmUsage | null;
}): ImplementationCodeTaskPlanV1 {
  return {
    ...input.plan,
    ...(input.sourceTaskListFingerprint
      ? { sourceTaskListFingerprint: input.sourceTaskListFingerprint }
      : {}),
    ...(input.sourceSeedFingerprint ? { sourceSeedFingerprint: input.sourceSeedFingerprint } : {}),
    ...(input.llmPromptFingerprint ? { llmPromptFingerprint: input.llmPromptFingerprint } : {}),
    ...(input.llmResultFingerprint ? { llmResultFingerprint: input.llmResultFingerprint } : {}),
    ...(input.refinementRequestedAt ? { refinementRequestedAt: input.refinementRequestedAt } : {}),
    ...(input.refinementCompletedAt ? { refinementCompletedAt: input.refinementCompletedAt } : {}),
    ...(input.llmUsage ? { llmUsage: input.llmUsage } : {}),
  };
}
