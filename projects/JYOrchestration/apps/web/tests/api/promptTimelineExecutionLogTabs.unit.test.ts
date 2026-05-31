import { describe, expect, it } from "vitest";
import {
  buildTaskCursorAutoChainTimelineEntry,
  buildTaskCursorPollLifecycleTimelineEntry,
} from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  buildExecutionLogEntryCopyText,
  buildExecutionLogTimelineMarkdown,
  formatExecutionLogTimelineLabel,
  isExecutionLogTimelineEntry,
  parseExecutionLogResponseFields,
  pickExecutionLogTimelineEntries,
} from "@/lib/prototype/promptTimelineExecutionLogTabs";

describe("promptTimelineExecutionLogTabs", () => {
  it("includes all implementation-stage timeline entries", () => {
    const timeline = [
      {
        stage: "implementation",
        action: "task_cursor_api_started",
        source: "platform",
        responseText: "runId=abc taskId=DEV-001",
        createdAt: "2026-05-30T12:00:00.000Z",
      },
      {
        stage: "implementation",
        action: "implementation_intent_routed",
        source: "platform",
        responseText: "type=implementation_intent_routed suggestedActionId=CREATE_WORK_PLAN",
        createdAt: "2026-05-30T12:00:30.000Z",
      },
      {
        stage: "implementation",
        action: "implementation_work_plan_draft_generated",
        source: "openai",
        createdAt: "2026-05-30T12:01:00.000Z",
      },
      {
        stage: "ideation",
        action: "ideation_bootstrap",
        source: "platform",
        createdAt: "2026-05-30T12:01:30.000Z",
      },
    ];
    const logs = pickExecutionLogTimelineEntries(timeline);
    expect(logs).toHaveLength(3);
    expect(isExecutionLogTimelineEntry(logs[0]!)).toBe(true);
    expect(formatExecutionLogTimelineLabel(logs[0]!)).toBe("Cursor 작업 진행 중 · DEV-001");
    expect(formatExecutionLogTimelineLabel(logs[1]!)).toBe("구현 의도 라우팅");
  });

  it("parses key=value response fields", () => {
    const fields = parseExecutionLogResponseFields(
      "type=task_cursor_auto_chain_continued_after_failure kind=continue_after_failure failedTaskId=DEV-001 toTaskId=DEV-002 blockedTaskIds=DEV-003,DEV-004 notice=hello | world",
    );
    expect(fields.kind).toBe("continue_after_failure");
    expect(fields.failedTaskId).toBe("DEV-001");
    expect(fields.toTaskId).toBe("DEV-002");
    expect(fields.blockedTaskIds).toBe("DEV-003,DEV-004");
    expect(fields.notice).toBe("hello | world");
  });

  it("ignores null timeline entries", () => {
    const timeline = [
      null,
      {
        stage: "implementation",
        action: "task_cursor_api_completed",
        source: "platform",
        createdAt: "2026-05-30T12:02:00.000Z",
      },
    ] as const;
    expect(pickExecutionLogTimelineEntries(timeline)).toHaveLength(1);
    expect(isExecutionLogTimelineEntry(null)).toBe(false);
  });

  it("builds copy text and markdown export for execution log entries", () => {
    const entry = {
      stage: "implementation",
      action: "task_cursor_api_started",
      source: "platform",
      orchestrationTraceGroup: "task_cursor_execution",
      responseText: "type=task_cursor_api_started taskId=DEV-001 status=cursor_running",
      createdAt: "2026-05-30T12:00:00.000Z",
    };
    const copyText = buildExecutionLogEntryCopyText(entry);
    expect(copyText).toContain("Cursor 작업 진행 중 · DEV-001");
    expect(copyText).toContain("taskId: DEV-001");
    expect(copyText).toContain("action: task_cursor_api_started");

    const md = buildExecutionLogTimelineMarkdown([entry]);
    expect(md).toContain("# 실행 로그");
    expect(md).toContain("## 1. Cursor 작업 진행 중 · DEV-001");
    expect(md).toContain("taskId: DEV-001");
  });
});

describe("implementationExecutionLogTimeline", () => {
  it("builds auto-chain timeline entries with detailed fields", () => {
    const entry = buildTaskCursorAutoChainTimelineEntry({
      decision: {
        kind: "continue_after_failure",
        failedTaskId: "DEV-001",
        toTaskId: "DEV-002",
        blockedTaskIds: ["DEV-003"],
      },
      notice: "다음 작업 계속",
      triggerActionOutcome: "executed",
    });
    expect(entry.stage).toBe("implementation");
    expect(entry.action).toBe("task_cursor_auto_chain_continued_after_failure");
    expect(entry.responseText).toContain("failedTaskId=DEV-001");
    expect(entry.responseText).toContain("blockedTaskCount=1");
  });

  it("builds poll lifecycle timeline entries", () => {
    const entry = buildTaskCursorPollLifecycleTimelineEntry({
      action: "task_cursor_poll_tick",
      projectId: "p1",
      taskId: "DEV-001",
      runId: "bc-123",
      round: 3,
      agentStatus: "RUNNING",
      executionStatus: "cursor_running",
    });
    expect(entry.action).toBe("task_cursor_poll_tick");
    expect(entry.responseText).toContain("round=3");
    expect(entry.responseText).toContain("agentStatus=RUNNING");
  });
});
