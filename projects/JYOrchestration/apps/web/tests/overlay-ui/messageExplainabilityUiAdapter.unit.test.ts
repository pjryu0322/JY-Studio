import { describe, expect, it } from "vitest";

import {
  MESSAGE_EXPLAINABILITY_DISCLAIMER,
  MESSAGE_EXPLAINABILITY_EMPTY_COPY,
  messageExplainabilityConfidenceUserLabel,
  messageExplainabilityRiskLabel,
  messageExplainabilityRiskTone,
  messageExplainabilitySectionTitle,
} from "@/lib/overlay-ui/messageExplainabilityUiAdapter";

describe("messageExplainabilityUiAdapter", () => {
  it("maps section types to Korean titles", () => {
    expect(messageExplainabilitySectionTitle("role")).toBe("AI 역할");
    expect(messageExplainabilitySectionTitle("issue_planning")).toBe("이슈 후보");
    expect(messageExplainabilitySectionTitle("warnings")).toBe("경고");
  });

  it("maps risk levels to labels and tones", () => {
    expect(messageExplainabilityRiskLabel("none")).toBe("정상");
    expect(messageExplainabilityRiskLabel("high")).toBe("위험 신호");
    expect(messageExplainabilityRiskTone("high")).toBe("danger");
    expect(messageExplainabilityRiskTone("low")).toBe("info");
  });

  it("maps confidence to user-facing labels without raw keys", () => {
    expect(messageExplainabilityConfidenceUserLabel("response_text")).toBe("관련 AI 판단 근거 연결됨");
    expect(messageExplainabilityConfidenceUserLabel("direct")).toContain("직접");
    expect(messageExplainabilityConfidenceUserLabel("response_text")).not.toContain("response_text");
  });

  it("provides empty copy and disclaimer", () => {
    expect(MESSAGE_EXPLAINABILITY_EMPTY_COPY.length).toBeGreaterThan(10);
    expect(MESSAGE_EXPLAINABILITY_DISCLAIMER).toContain("실제 실행");
  });
});
