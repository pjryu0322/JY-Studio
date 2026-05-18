import { describe, expect, it } from "vitest";

import type { OverlayUiWarningRow } from "@/lib/overlay-ui/overlayUiAdapter";
import { groupOverlayUiWarningRows } from "@/lib/overlay-ui/overlayWarningFocus";

describe("groupOverlayUiWarningRows", () => {
  it("collapses duplicate codes into counts", () => {
    const rows: OverlayUiWarningRow[] = [
      { code: "X", severityLabel: "경고", severityTone: "warning", message: "a" },
      { code: "X", severityLabel: "경고", severityTone: "warning", message: "b" },
    ];
    const g = groupOverlayUiWarningRows(rows);
    expect(g).toHaveLength(1);
    expect(g[0]?.count).toBe(2);
    expect(g[0]?.code).toBe("X");
  });
});
