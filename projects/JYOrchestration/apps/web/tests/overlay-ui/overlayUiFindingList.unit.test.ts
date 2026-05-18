import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OverlayUiFindingList } from "@/components/orchestration/overlay/OverlayUiPrimitives";
import { OVERLAY_MAX_VISIBLE_FINDINGS } from "@/lib/overlay-ui/overlayRenderingBudget";

describe("OverlayUiFindingList", () => {
  it("clips findings and shows overflow hint", () => {
    const n = OVERLAY_MAX_VISIBLE_FINDINGS + 3;
    const findings = Array.from({ length: n }, (_, i) => ({
      code: `c${i}`,
      severityLabel: "INFO",
      message: `m${i}`,
    }));
    const html = renderToStaticMarkup(createElement(OverlayUiFindingList, { findings }));
    expect(html.match(/<li/g)?.length).toBe(OVERLAY_MAX_VISIBLE_FINDINGS);
    expect(html).toContain(`추가 3건 숨김`);
  });

  it("renders all rows when maxFindings is 0 (no cap)", () => {
    const findings = [
      { code: "a", severityLabel: "X", message: "one" },
      { code: "b", severityLabel: "Y", message: "two" },
    ];
    const html = renderToStaticMarkup(createElement(OverlayUiFindingList, { findings, maxFindings: 0 }));
    expect(html.match(/<li/g)?.length).toBe(2);
    expect(html).not.toContain("추가");
  });
});
