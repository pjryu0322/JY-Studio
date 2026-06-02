import { describe, expect, it } from "vitest";
import { buildImplementationQuickRunCursorDispatchTimelineEntry } from "@/lib/prototype/implementationQuickRun";

describe("buildImplementationQuickRunCursorDispatchTimelineEntry", () => {
  it("records cursor dispatch outcome for execution log", () => {
    const entry = buildImplementationQuickRunCursorDispatchTimelineEntry({
      projectId: "p1",
      taskId: "DEV-MOCK-001",
      outcome: "blocked",
      message: "환경설정에서 [연결 테스트]를 완료한 뒤 AI 개발자 실행을 요청할 수 있습니다.",
      nowIso: "2026-06-01T21:43:13.374Z",
    });
    expect(entry.action).toBe("implementation_quick_run_cursor_dispatch");
    expect(entry.responseText).toContain("outcome=blocked");
    expect(entry.responseText).toContain("taskId=DEV-MOCK-001");
    expect(entry.responseText).toContain("REQUEST_TASK_CURSOR_EXECUTION");
    expect(entry.orchestrationTraceGroup).toBe("implementation_orchestration");
  });
});
