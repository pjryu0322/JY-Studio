import { describe, expect, it } from "vitest";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import {
  buildConversationContentHtmlForWorkNoteSummary,
  isAiWorkNoteSummaryMessage,
  shouldIncludeMessageForMessengerSummary,
} from "@/lib/worknote/buildConversationContentHtmlForWorkNoteSummary";
import { MESSENGER_CONVERSATION_SUMMARIZE_SYSTEM_PROMPT } from "@/lib/worknote/runMessengerConversationSummarizeLlm";

describe("MESSENGER_CONVERSATION_SUMMARIZE_SYSTEM_PROMPT", () => {
  it("forbids work-note priority fields and prescribes brainstorm sections", () => {
    const sys = MESSENGER_CONVERSATION_SUMMARIZE_SYSTEM_PROMPT;
    expect(sys).toContain("요청 분류");
    expect(sys).toContain("우선순위");
    expect(sys).toContain("P1/P2/P3");
    expect(sys).toContain("출력하지 않습니다");
    expect(sys).toContain("현재 아이디어");
    expect(sys).toContain("사용자가 선택/선호한 방향");
    expect(sys).toContain("논의된 대안");
    expect(sys).toContain("남은 쟁점");
    expect(sys).toContain("다음에 이어서 논의할 수 있는 항목");
  });
});

describe("messenger summary input filtering", () => {
  it("excludes prior AI summary blocks and auto-reply system notices", () => {
    const priorSummary = newRequirementsMessage({
      role: "ai",
      speakerType: "AI",
      speakerId: "ai",
      speakerName: "AI 기획자",
      messageType: "ANSWER",
      content: "【AI 요약 정리】\n\n이전 요약",
      meta: { internalType: "ai_work_note_summary", stage: "REQUIREMENTS" },
    });
    expect(isAiWorkNoteSummaryMessage(priorSummary)).toBe(true);
    expect(shouldIncludeMessageForMessengerSummary(priorSummary)).toBe(false);

    const autoReply = newRequirementsMessage({
      role: "system",
      speakerType: "SYSTEM",
      speakerId: "system",
      speakerName: "시스템",
      messageType: "NOTICE",
      content: "AI 기획자가 메시지에 자동으로 응답합니다.",
      meta: { internalType: "messenger_room", stage: "REQUIREMENTS" },
    });
    expect(shouldIncludeMessageForMessengerSummary(autoReply)).toBe(false);

    const user = newRequirementsMessage({
      role: "user",
      speakerType: "USER",
      speakerId: "u1",
      speakerName: "나",
      messageType: "STATEMENT",
      content: "녹취를 회의록으로 정리하는 서비스를 만들고 싶어",
      meta: { internalType: "messenger_room", stage: "REQUIREMENTS" },
    });
    expect(shouldIncludeMessageForMessengerSummary(user)).toBe(true);

    const html = buildConversationContentHtmlForWorkNoteSummary(
      [priorSummary, autoReply, user],
      "나",
      { forMessengerSummary: true }
    );
    expect(html).toContain("녹취를 회의록으로");
    expect(html).not.toContain("이전 요약");
    expect(html).not.toContain("자동으로 응답합니다");
  });
});
