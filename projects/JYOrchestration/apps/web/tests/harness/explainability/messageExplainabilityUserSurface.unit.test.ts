import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MessageExplainabilityPanel } from "@/components/orchestration/explainability/MessageExplainabilityPanel";
import { buildMessageExplainabilityViewModel } from "@/lib/harness/explainability/buildMessageExplainabilityViewModel";
import { checkMessageExplainabilityUserExposure } from "@/lib/harness/explainability/messageExplainabilityUserExposurePolicy";

/**
 * H8.5 — 사용자 노출 explainability **표면**(정책 + 패널 렌더) 통합 스모크.
 * 세부 규칙은 `messageExplainabilityUserExposurePolicy`·`MessageExplainabilityPanel` 테스트에 위임.
 */
describe("messageExplainabilityUserSurface", () => {
  it("passes exposure checks and renders without internal field names", () => {
    const vm = buildMessageExplainabilityViewModel({
      overlayExtract: {
        overlayIdentity: { roleKey: "planner", perspective: "기획", provider: "p", capabilities: [] },
      },
    });
    expect(checkMessageExplainabilityUserExposure(vm).ok).toBe(true);

    const html = renderToStaticMarkup(
      createElement(MessageExplainabilityPanel, {
        vm,
        defaultOpen: true,
        promptTimelineAvailable: true,
        onOpenPromptTimeline: () => {},
        connectionQualityLabel: "연결 품질",
      })
    );
    expect(html).toContain("AI 판단 보기");
    expect(html).not.toMatch(/knowledgePackId/);
  });
});
