import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CompletedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import type { CodeTaskConflictPlanV1 } from "@/lib/prototype/codeTaskFileConflictPlanner";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

export type IntegrationConflictPrecheckV1 = Readonly<{
  readonly status: "passed" | "warning" | "blocking";
  readonly overlapFiles: readonly {
    readonly filePath: string;
    readonly codeTaskIds: readonly string[];
    readonly branches: readonly string[];
  }[];
  readonly message?: string;
}>;

function taskDependsOn(
  plan: ImplementationCodeTaskPlanV1 | null,
  fromCodeTaskId: string,
  toCodeTaskId: string,
): boolean {
  const task = plan?.tasks.find((t) => t.codeTaskId === fromCodeTaskId);
  if (!task) return false;
  const deps = [
    ...(task.dependencies ?? []),
    ...(task.codeTaskDependencies ?? []),
  ];
  return deps.includes(toCodeTaskId);
}

export function runIntegrationConflictPrecheck(input: {
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly codeTaskRuns: readonly CodeTaskExecutionRunV1[] | null;
  readonly conflictPlan?: CodeTaskConflictPlanV1 | null;
}): IntegrationConflictPrecheckV1 {
  const fileToTasks = new Map<string, { codeTaskIds: Set<string>; branches: Set<string> }>();

  for (const item of input.included) {
    const run = findLatestRunForCodeTask(input.codeTaskRuns ?? [], item.codeTaskId);
    const files = [...(run?.changedFiles ?? [])].map((f) => f.trim()).filter(Boolean);
    const branch = String(item.workBranch ?? run?.workBranch ?? "").trim();
    for (const filePath of files) {
      const row = fileToTasks.get(filePath) ?? {
        codeTaskIds: new Set<string>(),
        branches: new Set<string>(),
      };
      row.codeTaskIds.add(item.codeTaskId);
      if (branch) row.branches.add(branch);
      fileToTasks.set(filePath, row);
    }
  }

  const overlapFiles = [...fileToTasks.entries()]
    .filter(([, v]) => v.codeTaskIds.size > 1)
    .map(([filePath, v]) => ({
      filePath,
      codeTaskIds: [...v.codeTaskIds],
      branches: [...v.branches],
    }));

  if (!overlapFiles.length) {
    return { status: "passed", overlapFiles: [] };
  }

  let blocking = false;
  for (const overlap of overlapFiles) {
    const ids = overlap.codeTaskIds;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const ordered =
          taskDependsOn(input.codeTaskPlan, b, a) || taskDependsOn(input.codeTaskPlan, a, b);
        if (!ordered) blocking = true;
      }
    }
  }

  const blockingFromPlan = (input.conflictPlan?.issues ?? []).some(
    (i) => i.severity === "blocking" && i.reason === "shared_shell_file",
  );
  if (blockingFromPlan) blocking = true;

  if (blocking) {
    return {
      status: "blocking",
      overlapFiles,
      message: `completed branch changed files overlap (${overlapFiles.length} files) — merge 전 충돌 위험`,
    };
  }

  return {
    status: "warning",
    overlapFiles,
    message: "changed files overlap — dependency 순서로 병합합니다.",
  };
}
