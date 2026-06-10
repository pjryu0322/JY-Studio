import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectionCheckResultTable } from "@/components/settings/ConnectionCheckResultTable";

describe("ConnectionCheckResultTableLayout", () => {
  it("applies nowrap to status column to avoid vertical character breaks", () => {
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
            currentValue: "—",
          },
        ],
        showPlaceholder: false,
        openHelpKey: null,
        onToggleHelp: () => {},
        triggerRefs: { current: {} },
      }),
    );
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain("min-width:72px");
  });
});
