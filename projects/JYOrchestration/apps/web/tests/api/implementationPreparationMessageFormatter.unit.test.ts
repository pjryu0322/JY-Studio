import { describe, expect, it } from "vitest";
import {
  buildImplementationPreparationDiagnostics,
  formatImplementationPreparationDiagnostics,
  formatImplementationPreparationUserMessage,
  buildImplementationPreparationUserSummary,
} from "@/lib/requirements/implementationPreparationMessageFormatter";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const NOW = "2026-06-01T00:00:00.000Z";

describe("formatImplementationPreparationUserMessage", () => {
  it("lists counts without internal diagnostic strings", () => {
    const text = formatImplementationPreparationUserMessage(
      buildImplementationPreparationUserSummary({
        taskList: {
          version: 1,
          projectId: "p1",
          createdAt: NOW,
          updatedAt: NOW,
          source: "implementation_seed_v1",
          tasks: [
            { taskId: "F1", taskType: "frame", ownerRole: "developer" } as never,
            { taskId: "D1", ownerRole: "developer" } as never,
          ],
          roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
        },
        codeTaskPlan: { codeTaskCount: 15, tasks: [] } as ImplementationCodeTaskPlanV1,
        workItemCount: 16,
        templateNameKo: "대시보드",
      }),
    );
    expect(text).toContain("구현 준비 항목을 생성했습니다.");
    expect(text).toContain("CodeTask: 15개");
    expect(text).not.toContain("Fallback");
    expect(text).not.toContain("Batch");
    expect(text).not.toContain("소요 시간");
    expect(text).not.toMatch(/\n\n\n/);
  });
});

describe("formatImplementationPreparationDiagnostics", () => {
  it("preserves fallback batch and elapsed details", () => {
    const plan = {
      codeTaskCount: 15,
      tasks: [],
      refinementStatus: "heuristic_only",
      llmRefinementSummary: {
        totalBatches: 16,
        llmRefinedTaskCount: 0,
        fallbackTaskCount: 16,
        concurrency: 4,
        elapsedMs: 120_000,
      },
    } as ImplementationCodeTaskPlanV1;

    const diagnostics = buildImplementationPreparationDiagnostics({ codeTaskPlan: plan });
    expect(diagnostics).not.toBeNull();
    const text = formatImplementationPreparationDiagnostics(diagnostics!);
    expect(text).toContain("Fallback");
    expect(text).toContain("Batch");
    expect(text).toContain("병렬 처리");
    expect(text).toContain("소요 시간");
  });
});
