import { describe, expect, it } from "vitest";
import { buildImplementationPreviewViewerWindowFeatures } from "@/lib/prototype/implementationPreviewViewerWindow";

describe("implementationPreviewViewerWindow", () => {
  it("does not include noopener or noreferrer in window features", () => {
    const features = buildImplementationPreviewViewerWindowFeatures({
      screenAvailWidth: 1600,
      screenAvailHeight: 900,
    });
    expect(features).not.toMatch(/noopener/i);
    expect(features).not.toMatch(/noreferrer/i);
    expect(features).toContain("popup=yes");
    expect(features).toMatch(/width=\d+/);
    expect(features).toMatch(/height=\d+/);
  });
});
