import { describe, expect, it } from "vitest";
import {
  compactReplyQuestionSnippet,
  formatSingleChatReplyReferenceLine,
} from "../../src/lib/requirements/singleChatReplyReference";
import type { RequirementsMessage } from "../../src/lib/requirements/requirementsMessage";

function aiMsg(content: string): RequirementsMessage {
  return {
    id: "m1",
    role: "ai",
    speakerType: "AI",
    speakerId: "virtual:ai-planner",
    speakerName: "AI 기획자",
    visibility: "PUBLIC",
    messageType: "ANSWER",
    content,
    createdAt: "2026-01-01T00:00:00.000Z",
    meta: { stage: "REQUIREMENTS", promptVersion: "v1", problemInterviewLastSlot: "targetUser" },
  };
}

describe("singleChatReplyReference", () => {
  it("snippet prefers question-shaped tail", () => {
    const body = "요약입니다.\n\n질문:\n주 사용자는 누구인가요?";
    expect(compactReplyQuestionSnippet(body)).toContain("?");
  });

  it("formats AI reply reference with speaker and short snippet", () => {
    const line = formatSingleChatReplyReferenceLine(aiMsg('안내\n\n질문:\n주 사용자는 누구인가요?'));
    expect(line.startsWith("↪")).toBe(true);
    expect(line).toContain("AI 기획자");
    expect(line.length).toBeLessThan(120);
  });

  it("does not inject duplicate user bubble text — reference is separate from body", () => {
    const ref = formatSingleChatReplyReferenceLine(aiMsg("질문 한 줄?"));
    expect(ref).not.toContain("사용자 본문");
  });
});
