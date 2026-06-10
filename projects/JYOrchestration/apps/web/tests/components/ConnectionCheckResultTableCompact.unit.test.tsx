import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectionCheckResultTable } from "@/components/settings/ConnectionCheckResultTable";

describe("ConnectionCheckResultTableCompact", () => {
  it("uses fixed table layout and compact column widths", () => {
    const html = renderToStaticMarkup(
      createElement(ConnectionCheckResultTable, {
        title: "자동 생성 기본 점검",
        testId: "auto-gen-envcheck",
        rows: [
          {
            key: "branch_create",
            label: "Branch 생성",
            status: "건너뜀",
            statusTone: "neutral",
            currentValue: "건너뜀",
            detailMessage: "skipped reason",
          },
        ],
        showPlaceholder: false,
        openHelpKey: null,
        onToggleHelp: () => {},
        triggerRefs: { current: {} },
      }),
    );
    expect(html).toContain("table-layout:fixed");
    expect(html).toContain("min-width:64px");
    expect(html).toContain("width:48px");
    expect(html).toContain('title="skipped reason"');
  });
});
