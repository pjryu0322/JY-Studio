import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MessageExplainabilityPanel } from "@/components/orchestration/explainability/MessageExplainabilityPanel";
import { buildMessageExplainabilityViewModel } from "@/lib/harness/explainability/buildMessageExplainabilityViewModel";
import { MESSAGE_EXPLAINABILITY_DISCLAIMER } from "@/lib/overlay-ui/messageExplainabilityUiAdapter";

describe("MessageExplainabilityPanel", () => {
  it("renders summary, risk badge, sections, disclaimer when open", () => {
    const vm = buildMessageExplainabilityViewModel({
      overlayExtract: {
        overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "p", capabilities: [] },
      },
    });
    expect(vm.hasData).toBe(true);
    const html = renderToStaticMarkup(
      createElement(MessageExplainabilityPanel, {
        vm,
        defaultOpen: true,
        promptTimelineAvailable: true,
        onOpenPromptTimeline: () => {},
      })
    );
    expect(html).toContain("AI 판단 보기");
    expect(html).toContain("AI 판단 요약");
    expect(html).toContain(MESSAGE_EXPLAINABILITY_DISCLAIMER.slice(0, 24));
    expect(html).toContain("프롬프트 이력에서 자세히 보기");
    expect(html).toContain("AI 역할");
    expect(html).not.toMatch(/knowledgePackId/);
  });
});
