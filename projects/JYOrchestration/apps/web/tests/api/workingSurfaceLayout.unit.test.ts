import { describe, expect, it } from "vitest";

import {
  desktopMainMaxWidthPx,
  normalizePathnameOnly,
  resolveWorkingSurfaceFromPathname,
  suggestedOuterWindowSize,
} from "@/lib/ui/workingSurfaceLayout";

describe("workingSurfaceLayout", () => {
  it("normalizePathnameOnly strips query and keeps leading slash", () => {
    expect(normalizePathnameOnly("/knowledge-packs?id=1")).toBe("/knowledge-packs");
    expect(normalizePathnameOnly("/workspace")).toBe("/workspace");
  });

  it("resolveWorkingSurfaceFromPathname maps major routes", () => {
    expect(resolveWorkingSurfaceFromPathname("/")).toBe("messenger");
    expect(resolveWorkingSurfaceFromPathname("/chat/abc")).toBe("messenger");
    expect(resolveWorkingSurfaceFromPathname("/notifications")).toBe("messenger");
    expect(resolveWorkingSurfaceFromPathname("/workspace")).toBe("workspace");
    expect(resolveWorkingSurfaceFromPathname("/knowledge-packs")).toBe("knowledge");
    expect(resolveWorkingSurfaceFromPathname("/requirements/p1")).toBe("requirements");
    expect(resolveWorkingSurfaceFromPathname("/projects/x")).toBe("requirements");
    expect(resolveWorkingSurfaceFromPathname("/account")).toBe("settings");
    expect(resolveWorkingSurfaceFromPathname("/settings")).toBe("settings");
    expect(resolveWorkingSurfaceFromPathname("/admin/platform-users")).toBe("settings");
    expect(resolveWorkingSurfaceFromPathname("/prompt-timeline")).toBe("general");
  });

  it("desktopMainMaxWidthPx returns sensible caps per surface", () => {
    expect(desktopMainMaxWidthPx("messenger")).toBeLessThan(desktopMainMaxWidthPx("workspace"));
    expect(desktopMainMaxWidthPx("knowledge")).toBeGreaterThan(desktopMainMaxWidthPx("messenger"));
    expect(desktopMainMaxWidthPx("settings")).toBeLessThan(1100);
  });

  it("suggestedOuterWindowSize clamps to available screen", () => {
    const { w, h } = suggestedOuterWindowSize("messenger", 800, 700);
    expect(w).toBeLessThanOrEqual(760);
    expect(h).toBeLessThanOrEqual(660);
    expect(w).toBeGreaterThanOrEqual(720);
    expect(h).toBeGreaterThanOrEqual(560);
  });
});
