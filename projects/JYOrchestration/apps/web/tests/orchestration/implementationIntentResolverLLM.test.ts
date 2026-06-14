import { describe, expect, it } from "vitest";
import { parseImplementationIntentResolverJson } from "@/lib/prototype/implementationIntentResolverTypes";
import { parseImplementationPreviewFeedbackAnalysisJson } from "@/lib/prototype/implementationPreviewFeedbackTypes";
import { mapIntentResolverToControlIntent } from "@/lib/prototype/implementationWorkingQueueLlmMapping";
import { readImplementationWorkingQueueFromState } from "@/lib/prototype/implementationWorkingQueueState";

describe("implementationIntentResolverLLM parse", () => {
  it("parses approve_pending_work_queue with pending context", () => {
    const parsed = parseImplementationIntentResolverJson({
      intent: "approve_pending_work_queue",
      confidence: "high",
      targetQueueItemIds: ["latest_pending"],
      reason: "직전 AI가 작업대기 승인을 요청함",
    });
    expect(parsed?.intent).toBe("approve_pending_work_queue");
    const queue = readImplementationWorkingQueueFromState({}, "p1");
    const withPending = {
      ...queue,
      items: [
        {
          id: "iwq-1",
          projectId: "p1",
          title: "t",
          description: "d",
          rawUserMessage: "x",
          affectedArea: "ui" as const,
          status: "pending" as const,
          riskLevel: "low" as const,
          createdAt: "t",
          updatedAt: "t",
        },
      ],
    };
    const control = mapIntentResolverToControlIntent({
      resolver: parsed!,
      queue: withPending,
    });
    expect(control?.kind).toBe("approve_ids");
  });

  it("parses start_initial_quick_run", () => {
    const parsed = parseImplementationIntentResolverJson({
      intent: "start_initial_quick_run",
      confidence: "high",
      reason: "ready with runnable tasks",
    });
    expect(parsed?.intent).toBe("start_initial_quick_run");
  });

  it("parses ask_clarification for vague 부탁해", () => {
    const parsed = parseImplementationIntentResolverJson({
      intent: "ask_clarification",
      confidence: "low",
      clarificationQuestion: "어떤 작업을 진행할까요?",
      reason: "문맥 불명확",
    });
    expect(parsed?.intent).toBe("ask_clarification");
  });
});

describe("implementationPreviewFeedbackAnalyzer parse", () => {
  it("parses structured preview feedback JSON", () => {
    const parsed = parseImplementationPreviewFeedbackAnalysisJson({
      intent: "implementation_preview_feedback",
      title: "스크립트 탭 클릭 이벤트",
      description: "스크립트 탭 클릭 시 내용 표시",
      targetUi: "결과 패널 스크립트 탭",
      desiredBehavior: "클릭하면 스크립트 내용 표시",
      affectedArea: "ui",
      riskLevel: "low",
      needsClarification: false,
      confidence: "high",
      reason: "explicit request",
    });
    expect(parsed?.title).toContain("스크립트");
    expect(parsed?.targetUi).toContain("스크립트");
  });
});
