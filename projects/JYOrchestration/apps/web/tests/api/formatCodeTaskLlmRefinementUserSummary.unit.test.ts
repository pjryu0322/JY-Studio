import { describe, expect, it } from "vitest";
import { formatCodeTaskLlmRefinementUserSummaryLines } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const NOW = "2026-06-01T00:00:00.000Z";

describe("formatCodeTaskLlmRefinementUserSummaryLines", () => {
  it("formats full success summary", () => {
    const plan = {
      version: "implementation_code_task_plan_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_task_list",
      parentTaskCount: 1,
      codeTaskCount: 55,
      tasks: [],
      readiness: { ready: true, missing: [] },
      refinementStatus: "llm_refined",
      llmRefinementSummary: {
        totalBatches: 14,
        llmRefinedBatches: 14,
        fallbackBatches: 0,
        llmRefinedTaskCount: 55,
        fallbackTaskCount: 0,
        concurrency: 3,
        elapsedMs: 62_000,
      },
    } as ImplementationCodeTaskPlanV1;

    const lines = formatCodeTaskLlmRefinementUserSummaryLines(plan);
    expect(lines.join("\n")).toContain("전체 CodeTask: 55개");
    expect(lines.join("\n")).toContain("LLM 정제: 55개");
    expect(lines.join("\n")).toContain("Fallback: 0개");
    expect(lines.join("\n")).toContain("Batch: 14개");
    expect(lines.join("\n")).toContain("LLM 정제 완료");
  });

  it("formats partial success summary", () => {
    const plan = {
      codeTaskCount: 55,
      tasks: [],
      refinementStatus: "llm_partial_refined",
      llmRefinementSummary: {
        totalBatches: 14,
        llmRefinedBatches: 12,
        fallbackBatches: 2,
        llmRefinedTaskCount: 42,
        fallbackTaskCount: 13,
      },
    } as ImplementationCodeTaskPlanV1;
    const text = formatCodeTaskLlmRefinementUserSummaryLines(plan).join("\n");
    expect(text).toContain("일부 정제 완료");
    expect(text).toContain("LLM 정제: 42개");
    expect(text).toContain("Fallback: 13개");
  });
});
