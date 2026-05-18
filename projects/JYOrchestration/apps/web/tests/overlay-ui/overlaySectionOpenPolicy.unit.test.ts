import { describe, expect, it } from "vitest";

import { resolveOverlaySectionUiPolicy } from "@/lib/overlay-ui/overlaySectionOpenPolicy";

describe("resolveOverlaySectionUiPolicy", () => {
  it("omits advanced sections on narrow compact for operator", () => {
    const p = resolveOverlaySectionUiPolicy({
      section: "harness_prompt_preview",
      baseDefaultOpen: true,
      compactMode: true,
      isNarrow: true,
      audience: "operator",
    });
    expect(p.omitFromDom).toBe(true);
  });

  it("keeps critical sections in dom for user compact narrow", () => {
    const p = resolveOverlaySectionUiPolicy({
      section: "warning",
      baseDefaultOpen: false,
      compactMode: true,
      isNarrow: true,
      audience: "user",
    });
    expect(p.omitFromDom).toBe(false);
    expect(p.defaultOpen).toBe(true);
  });

  it("hides review security for user regardless of compact", () => {
    const p = resolveOverlaySectionUiPolicy({
      section: "review_security",
      baseDefaultOpen: true,
      compactMode: false,
      isNarrow: false,
      audience: "user",
    });
    expect(p.omitFromDom).toBe(true);
  });
});
