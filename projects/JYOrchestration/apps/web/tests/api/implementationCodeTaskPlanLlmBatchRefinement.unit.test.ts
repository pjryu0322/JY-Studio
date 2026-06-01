import { describe, expect, it } from "vitest";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  buildCodeTaskLlmRefinementBatchPlan,
  CODE_TASK_LLM_BATCH_MAX_SIZE,
  mergeBatchedCodeTaskRefinementResults,
} from "@/lib/prototype/implementationCodeTaskPlanLlmBatchRefinement";

function task(codeTaskId: string, parentTaskId: string): ImplementationCodeTaskV1 {
  return {
    codeTaskId,
    parentTaskId,
    title: codeTaskId,
    description: codeTaskId,
    changeType: "component",
    targetHints: ["scope"],
    dependencies: [],
    parentTaskDependencies: [],
    codeTaskDependencies: [],
    acceptanceCriteria: ["done"],
    verificationHints: ["pnpm test"],
    forbiddenPaths: ["package.json"],
    priority: "P1",
    status: "ready",
    blockers: [],
    refinementSource: "heuristic",
  };
}

describe("buildCodeTaskLlmRefinementBatchPlan", () => {
  it("keeps a parent group in one batch when at or below max size", () => {
    const tasks = [task("C1", "P1"), task("C2", "P1"), task("C3", "P2")];
    const plan = buildCodeTaskLlmRefinementBatchPlan(tasks);
    expect(plan.batches).toHaveLength(2);
    expect(plan.batches[0]?.parentTaskIds).toEqual(["P1"]);
    expect(plan.batches[0]?.codeTaskIds).toEqual(["C1", "C2"]);
    expect(plan.batches[1]?.parentTaskIds).toEqual(["P2"]);
  });

  it("splits a large parent group into multiple batches", () => {
    const tasks = Array.from({ length: 12 }, (_, i) =>
      task(`C${String(i + 1).padStart(2, "0")}`, "P1"),
    );
    const plan = buildCodeTaskLlmRefinementBatchPlan(tasks);
    expect(plan.batches.length).toBeGreaterThan(1);
    expect(plan.batches.every((b) => b.codeTaskIds.length <= CODE_TASK_LLM_BATCH_MAX_SIZE)).toBe(true);
    expect(plan.batches.flatMap((b) => b.codeTaskIds)).toHaveLength(12);
  });
});

describe("mergeBatchedCodeTaskRefinementResults", () => {
  it("tracks llm vs fallback task counts", () => {
    const heuristic = [task("C1", "P1"), task("C2", "P1")];
    const llmRefined = [{ ...heuristic[0], refinementSource: "llm" as const, llmRationale: "r" }];
    const merge = mergeBatchedCodeTaskRefinementResults({
      heuristicTasks: heuristic,
      batchOutcomes: [
        { batch: { batchId: "b1", batchIndex: 0, parentTaskIds: ["P1"], codeTaskIds: ["C1"], heuristicTasks: [heuristic[0]] }, tasks: llmRefined, source: "llm" },
        { batch: { batchId: "b2", batchIndex: 1, parentTaskIds: ["P1"], codeTaskIds: ["C2"], heuristicTasks: [heuristic[1]] }, tasks: [heuristic[1]], source: "heuristic_fallback" },
      ],
    });
    expect(merge.llmRefinedTaskCount).toBe(1);
    expect(merge.fallbackTaskCount).toBe(1);
    expect(merge.llmRefinedBatches).toBe(1);
    expect(merge.fallbackBatches).toBe(1);
    expect(merge.mergedTasks[0]?.refinementSource).toBe("llm");
    expect(merge.mergedTasks[1]?.refinementSource).toBe("heuristic");
  });
});
