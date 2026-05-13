import { describe, expect, it } from "vitest";
import { buildOverlayWarningReport } from "@/lib/overlay/overlayWarningReport";

describe("buildOverlayWarningReport", () => {
  it("returns summary, sorted top warnings, and role/catalog recommendations", () => {
    const r = buildOverlayWarningReport({
      warnings: [
        {
          code: "OVERLAY_WORKSPACE_CATALOG_UNMAPPED",
          severity: "warning",
          message: "m",
          roleKey: "k1",
          source: "diagnostic",
          enforcement: "not_applied",
        },
        {
          code: "OVERLAY_ROLE_UNRESOLVED",
          severity: "warning",
          message: "r",
          source: "diagnostic",
          enforcement: "not_applied",
        },
      ],
    });
    expect(r.summary.warningCount).toBe(2);
    expect(r.topWarnings[0]?.severity).toBe("warning");
    expect(r.recommendations.some((x) => x.includes("추가"))).toBe(true);
    expect(r.recommendations.some((x) => x.includes("동기화"))).toBe(true);
  });

  it("adds cursor capability recommendation when that code is present", () => {
    const r = buildOverlayWarningReport({
      warnings: [
        {
          code: "OVERLAY_CURSOR_CAPABILITY_NOT_ALLOWED",
          severity: "warning",
          message: "c",
          source: "singlechat",
          enforcement: "not_applied",
        },
      ],
    });
    expect(r.recommendations.some((x) => x.includes("차단"))).toBe(true);
  });
});
