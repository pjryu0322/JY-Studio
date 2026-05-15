import { describe, expect, it } from "vitest";

import {
  MESSAGE_EXPLAINABILITY_DISCLAIMER,
  MESSAGE_EXPLAINABILITY_EMPTY_COPY,
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

  it("provides empty copy and disclaimer", () => {
    expect(MESSAGE_EXPLAINABILITY_EMPTY_COPY.length).toBeGreaterThan(10);
    expect(MESSAGE_EXPLAINABILITY_DISCLAIMER).toContain("실제 실행");
  });
});
