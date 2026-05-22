import { describe, expect, it } from "vitest";
import { buildConversationMarkdown, formatConversationSpeakerLabel } from "@/lib/chat/conversationMarkdown";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

const sampleMessage = (partial: Partial<RequirementsMessage> & Pick<RequirementsMessage, "role" | "content">): RequirementsMessage =>
  ({
    id: "m1",
    speakerType: "USER",
    speakerId: "u1",
    speakerName: "나",
    messageType: "STATEMENT",
    visibility: "PUBLIC",
    createdAt: "2026-05-19T10:00:00.000Z",
    meta: { stage: "REQUIREMENTS" },
    ...partial,
  }) as RequirementsMessage;

describe("conversationMarkdown", () => {
  it("formats speakers consistently", () => {
    expect(formatConversationSpeakerLabel(sampleMessage({ role: "user", content: "hi" }), "pjryu")).toBe("pjryu");
    expect(formatConversationSpeakerLabel(sampleMessage({ role: "ai", speakerName: "AI 기획자", content: "ok" }), "나")).toBe(
      "AI(AI 기획자)"
    );
  });

  it("builds markdown with scope and messages", () => {
    const md = buildConversationMarkdown({
      heading: "# 테스트",
      scopeLines: ["- roomId: r1"],
      messages: [sampleMessage({ role: "user", content: "안녕" })],
      meLabel: "나",
    });
    expect(md).toContain("# 테스트");
    expect(md).toContain("- roomId: r1");
    expect(md).toContain("## 나 ·");
    expect(md).toContain("안녕");
  });
});
