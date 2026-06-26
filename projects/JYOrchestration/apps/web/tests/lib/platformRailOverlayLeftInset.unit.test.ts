import { describe, expect, it } from "vitest";
import {
  PLATFORM_RAIL_EXPAND_TAB_W,
  PLATFORM_RAIL_WIDTH_PX,
  platformRailOverlayLeftInsetPx,
} from "@/lib/layout/platformTopNavConstants";

describe("platformRailOverlayLeftInsetPx", () => {
  it("uses full rail width when expanded", () => {
    expect(platformRailOverlayLeftInsetPx(false)).toBe(PLATFORM_RAIL_WIDTH_PX);
  });

  it("uses expand tab width when collapsed", () => {
    expect(platformRailOverlayLeftInsetPx(true)).toBe(PLATFORM_RAIL_EXPAND_TAB_W);
  });
});
