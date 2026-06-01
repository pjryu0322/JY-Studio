import { describe, expect, it } from "vitest";
import {
  buildImplementationReadinessUserSummary,
  formatCodeTaskLlmRefinementSummaryLines,
  formatElapsedMs,
  formatImplementationReadinessIntroLines,
} from "@/lib/prototype/implementationReadinessSummary";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

const NOW = "2026-06-01T00:00:00.000Z";

describe("formatElapsedMs", () => {
  it("formats sub-second, seconds, and minutes", () => {
    expect(formatElapsedMs(999)).toBe("1초 미만");
    expect(formatElapsedMs(45_000)).toBe("45초");
    expect(formatElapsedMs(165_945)).toBe("2분 45초");
  });
});

describe("buildImplementationReadinessUserSummary", () => {
  it("reads metrics from plan summary", () => {
    const plan = {
      codeTaskCount: 55,
      tasks: [],
      refinementStatus: "llm_refined",
      llmRefinementSummary: {
        totalBatches: 14,
        llmRefinedTaskCount: 55,
        fallbackTaskCount: 0,
        concurrency: 3,
        elapsedMs: 165_945,
      },
    } as ImplementationCodeTaskPlanV1;

    const summary = buildImplementationReadinessUserSummary({ codeTaskPlan: plan });
    expect(summary.statusLabel).toBe("LLM 정제 완료");
    expect(summary.elapsedLabel).toBe("2분 45초");
    expect(summary.concurrency).toBe(3);
  });

  it("falls back to timeline for concurrency and elapsed", () => {
    const timeline: RequirementsPromptTimelineEntry[] = [
      {
        action: "implementation_code_task_llm_refinement_passed",
        responseText: "type=implementation_code_task_llm_refinement_passed concurrency=3 elapsedMs=62000",
        createdAt: NOW,
      } as RequirementsPromptTimelineEntry,
    ];
    const plan = {
      codeTaskCount: 10,
      tasks: [],
      refinementStatus: "llm_refined",
    } as ImplementationCodeTaskPlanV1;

    const summary = buildImplementationReadinessUserSummary({
      codeTaskPlan: plan,
      timelineEntries: timeline,
    });
    expect(summary.concurrency).toBe(3);
    expect(summary.elapsedLabel).toBe("1분 2초");
  });
});

describe("formatImplementationReadinessIntroLines", () => {
  it("adds partial and full-fallback intros", () => {
    const partial = buildImplementationReadinessUserSummary({
      codeTaskPlan: {
        codeTaskCount: 55,
        tasks: [],
        refinementStatus: "llm_partial_refined",
        llmRefinementSummary: { llmRefinedTaskCount: 42, fallbackTaskCount: 13 },
      } as ImplementationCodeTaskPlanV1,
    });
    expect(formatImplementationReadinessIntroLines(partial)).toEqual([
      "일부 CodeTask는 기본 규칙 기반으로 대체되었습니다.",
    ]);

    const fallback = buildImplementationReadinessUserSummary({
      codeTaskPlan: {
        codeTaskCount: 55,
        tasks: [],
        refinementStatus: "heuristic_only",
        llmRefinementSummary: { llmRefinedTaskCount: 0, fallbackTaskCount: 55 },
      } as ImplementationCodeTaskPlanV1,
    });
    expect(formatImplementationReadinessIntroLines(fallback)).toEqual([
      "LLM 정제는 실패하여 기본 규칙 기반 CodeTask로 대체되었습니다.",
    ]);
  });
});

describe("formatCodeTaskLlmRefinementSummaryLines", () => {
  it("includes batch concurrency and elapsed labels", () => {
    const lines = formatCodeTaskLlmRefinementSummaryLines(
      buildImplementationReadinessUserSummary({
        codeTaskPlan: {
          codeTaskCount: 55,
          tasks: [],
          refinementStatus: "llm_refined",
          llmRefinementSummary: {
            totalBatches: 14,
            llmRefinedTaskCount: 55,
            fallbackTaskCount: 0,
            concurrency: 3,
            elapsedMs: 62_000,
          },
        } as ImplementationCodeTaskPlanV1,
      }),
    );
    const text = lines.join("\n");
    expect(text).toContain("병렬 처리: 3개씩");
    expect(text).toContain("소요 시간: 1분 2초");
  });
});
