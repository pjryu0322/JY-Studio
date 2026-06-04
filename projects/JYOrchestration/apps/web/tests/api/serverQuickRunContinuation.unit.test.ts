import { describe, expect, it } from "vitest";
import {
  buildQuickRunNextDispatchExecutedTimelineEntry,
  buildQuickRunNextDispatchPlannedTimelineEntry,
  buildQuickRunNextDispatchSkippedTimelineEntry,
} from "@/lib/prototype/quickRunNextDispatchTimeline";
import { buildCodeTaskExecutionFlowSteps } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import { evaluateCodeTaskReviewSecurityPolicy } from "@/lib/prototype/implementationReviewSecurityPolicy";

function policy() {
  return evaluateCodeTaskReviewSecurityPolicy({
    codeTask: {
      codeTaskId: "CODE-1",
      parentTaskId: "DEV-1",
      title: "t",
      description: "",
      changeType: "component",
      acceptanceCriteria: [],
      verificationHints: [],
      forbiddenPaths: [],
      candidateFiles: [],
      candidateFileHints: [],
      targetHints: [],
    },
    workItem: null,
  });
}

describe("quickRunNextDispatchTimeline", () => {
  it("builds planned/executed/skipped actions", () => {
    const planned = buildQuickRunNextDispatchPlannedTimelineEntry({
      projectId: "p1",
      completedTaskId: "T1",
      completedCodeTaskId: "CODE-A",
      nextTaskId: "T2",
      nextCodeTaskId: "CODE-B",
    });
    expect(planned.action).toBe("quick_run_next_dispatch_planned");

    const executed = buildQuickRunNextDispatchExecutedTimelineEntry({
      projectId: "p1",
      nextTaskId: "T2",
      nextCodeTaskId: "CODE-B",
      workBranch: "wip/cursor/code-b",
    });
    expect(executed.action).toBe("quick_run_next_dispatch_executed");

    const skipped = buildQuickRunNextDispatchSkippedTimelineEntry({
      projectId: "p1",
      completedTaskId: "T1",
      completedCodeTaskId: "CODE-A",
      reason: "no_next_task",
    });
    expect(skipped.action).toBe("quick_run_next_dispatch_skipped");
    expect(JSON.stringify(skipped)).toContain("no_next_task");
  });
});

describe("prompt_ready flow steps (M28)", () => {
  it("shows Cursor 실행 대기 instead of active Cursor 실행", () => {
    const steps = buildCodeTaskExecutionFlowSteps({ phase: "prompt_ready", policy: policy() });
    const prompt = steps.find((s) => s.id === "prompt_ready");
    const cursor = steps.find((s) => s.id === "cursor_running");
    expect(prompt?.state).toBe("done");
    expect(cursor?.state).toBe("pending");
    expect(cursor?.label).toBe("Cursor 실행 대기");
  });
});
