import { describe, expect, it } from "vitest";
import {
  computeKnowledgeGraphModalRailInset,
  knowledgeGraphModalShellDesktopStyles,
} from "@/lib/project-graph/projectKnowledgeGraphModalRailLayout";
import {
  PLATFORM_RAIL_EXPAND_TAB_W,
  PLATFORM_RAIL_WIDTH_PX,
} from "@/lib/layout/platformTopNavConstants";

describe("computeKnowledgeGraphModalRailInset", () => {
  it("returns rail width when preservePlatformRail on desktop", () => {
    expect(
      computeKnowledgeGraphModalRailInset({
        preservePlatformRail: true,
        fullscreen: false,
        railCollapsed: false,
      }),
    ).toBe(PLATFORM_RAIL_WIDTH_PX);
  });

  it("returns expand tab width when rail collapsed", () => {
    expect(
      computeKnowledgeGraphModalRailInset({
        preservePlatformRail: true,
        fullscreen: false,
        railCollapsed: true,
      }),
    ).toBe(PLATFORM_RAIL_EXPAND_TAB_W);
  });

  it("returns 0 on mobile fullscreen", () => {
    expect(
      computeKnowledgeGraphModalRailInset({
        preservePlatformRail: true,
        fullscreen: true,
        railCollapsed: false,
      }),
    ).toBe(0);
  });

  it("returns 0 when preservePlatformRail is off", () => {
    expect(
      computeKnowledgeGraphModalRailInset({
        preservePlatformRail: false,
        fullscreen: false,
        railCollapsed: false,
      }),
    ).toBe(0);
  });
});

describe("knowledgeGraphModalShellDesktopStyles", () => {
  it("offsets backdrop and dialog when rail inset applies", () => {
    const { backdrop, dialog } = knowledgeGraphModalShellDesktopStyles(PLATFORM_RAIL_WIDTH_PX);
    expect(backdrop.left).toBe(PLATFORM_RAIL_WIDTH_PX);
    expect(backdrop.inset).toBeUndefined();
    expect(String(dialog.left)).toContain(String(PLATFORM_RAIL_WIDTH_PX));
    expect(String(dialog.width)).toContain(String(PLATFORM_RAIL_WIDTH_PX));
  });

  it("uses full viewport layout when rail inset is 0", () => {
    const { backdrop, dialog } = knowledgeGraphModalShellDesktopStyles(0);
    expect(backdrop.inset).toBe(0);
    expect(dialog.left).toBe("5vw");
    expect(dialog.width).toBe("90vw");
  });
});
