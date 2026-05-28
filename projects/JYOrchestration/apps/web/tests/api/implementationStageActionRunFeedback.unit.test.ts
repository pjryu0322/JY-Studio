import { describe, expect, it } from "vitest";
import type { ImplementationStageActionRun } from "@/lib/prototype/implementationStageActionRun";
import {
  buildImplementationStageActionRunDebugSummary,
} from "@/lib/prototype/implementationStageActionRun";

const NOW = "2026-05-28T00:00:00.000Z";

function run(status: ImplementationStageActionRun["status"], message?: string): ImplementationStageActionRun {
  return {
    runId: `run-${status}`,
    projectId: "p1",
    actionId: "GENERATE_IMPLEMENTATION_WORK_PLAN",
    source: "natural_language",
    status,
    startedAt: NOW,
    completedAt: NOW,
    message,
    timelineEntries: [],
  };
}

describe("buildImplementationStageActionRunDebugSummary", () => {
  it("empty log", () => {
    expect(buildImplementationStageActionRunDebugSummary(null)).toBe("최근 실행 이력이 없습니다.");
  });

  it("includes latest succeeded and latest blocked message", () => {
    const log = {
      version: "implementation_stage_action_run_log_v1" as const,
      runs: [run("succeeded"), run("blocked", "seed not confirmed")],
      updatedAt: NOW,
    };
    const summary = buildImplementationStageActionRunDebugSummary(log);
    expect(summary).toContain("최근 실행:");
    expect(summary).toContain("succeeded");
    expect(summary).toContain("최근 차단:");
    expect(summary).toContain("seed not confirmed");
  });
});

