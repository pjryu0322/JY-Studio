import { describe, expect, it } from "vitest";
import {
  buildWorkingQueuePreviewFeedbackRegisteredAiMessage,
  buildWorkingQueueRegisteredAiMessage,
} from "@/lib/prototype/implementationWorkingQueueMessages";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";

function item(overrides: Partial<ImplementationWorkingQueueItem> = {}): ImplementationWorkingQueueItem {
  return {
    id: "iwq-1",
    projectId: "p1",
    title: "타이틀 굵게",
    description: "회의파일, 참여자 타이틀을 진하게 해줘",
    rawUserMessage: "회의파일, 참여자 타이틀을 진하게 해줘",
    affectedArea: "ui",
    status: "pending",
    riskLevel: "medium",
    createdAt: "2026-06-15T00:00:00.000Z",
    updatedAt: "2026-06-15T00:00:00.000Z",
    primaryRole: "designer",
    executionOwnerRole: "developer",
    reviewWorkflow: [
      { role: "designer", task: "ux_review", status: "pending" },
      { role: "developer", task: "developer_fix", status: "pending" },
    ],
    ...overrides,
  };
}

describe("workingQueueMessageCompactSpacing", () => {
  it("has no consecutive blank lines in single-item registration message", () => {
    const msg = buildWorkingQueueRegisteredAiMessage([item()]);
    expect(msg).not.toMatch(/\n\n\n/);
    expect(msg).not.toContain("\n\n");
    expect(msg).toContain("담당:");
    expect(msg).toContain("디자이너 검토 → 개발자 반영");
    expect(msg).toContain("[승인]");
    expect(msg).not.toMatch(/진행해/i);
  });

  it("preview registration message shows workflow compactly", () => {
    const msg = buildWorkingQueuePreviewFeedbackRegisteredAiMessage([item()]);
    expect(msg).toContain("Preview 캡처 기준으로 작업대기에 등록했습니다.");
    expect(msg).toContain("요청:");
    expect(msg.split("\n").filter((l) => l.trim() === "").length).toBe(0);
  });

  it("multi-item message avoids blank lines between bullets", () => {
    const msg = buildWorkingQueueRegisteredAiMessage([item({ id: "a" }), item({ id: "b", description: "두번째" })]);
    expect(msg).not.toContain("\n\n");
    expect(msg).toContain("보완요청 2건");
  });
});
