import { describe, expect, it } from "vitest";
import {
  buildRequirementsConversationHref,
  buildStructureCandidateExplainability,
  confidenceLabelFromScore,
  confidencePercentFromScore,
  truncateConversationExcerpt,
} from "@/lib/project-structure/projectStructureExplainability";

describe("projectStructureExplainability", () => {
  it("builds reason and confidence for requirement message event", () => {
    const ex = buildStructureCandidateExplainability({
      projectId: "p1",
      nodeType: "Requirement",
      title: "Login",
      summary: "Users need login",
      metadata: {},
      sourceEventId: "ev1",
      eventType: "conversation.message_created",
      messageContent: "회의 내용을 자동으로 정리하고 싶습니다.",
      sourceMessageId: "msg-1",
    });
    expect(ex.reason).toContain("Requirement");
    expect(ex.confidence).toBeGreaterThan(0);
    expect(ex.confidenceLabel).toBeTruthy();
    expect(ex.createdBy).toContain("AI Structure Engine");
    expect(ex.createdFrom.messageId).toBe("msg-1");
    expect(ex.sourceEvent.eventType).toBe("conversation.message_created");
    expect(ex.sourceConversation.excerpt).toContain("회의");
  });

  it("builds requirements deep link with message id", () => {
    const href = buildRequirementsConversationHref("p1", "msg-9");
    expect(href).toContain("projectId=p1");
    expect(href).toContain("sourceMessageId=msg-9");
  });

  it("maps confidence scores to labels", () => {
    expect(confidenceLabelFromScore(0.9)).toBe("High");
    expect(confidenceLabelFromScore(0.6)).toBe("Medium");
    expect(confidenceLabelFromScore(0.2)).toBe("Low");
    expect(confidencePercentFromScore(0.856)).toBe(86);
  });

  it("truncates long conversation excerpts", () => {
    const long = "a".repeat(400);
    expect(truncateConversationExcerpt(long).length).toBeLessThan(400);
  });
});
