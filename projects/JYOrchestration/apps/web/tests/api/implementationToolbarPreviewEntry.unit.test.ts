import { describe, expect, it } from "vitest";
import { resolveImplementationToolbarPreviewEntry } from "@/lib/prototype/implementationToolbarPreviewEntry";

describe("implementationToolbarPreviewEntry", () => {
  it("hides toolbar icon when preview is not ready", () => {
    const entry = resolveImplementationToolbarPreviewEntry({
      projectId: "p1",
      orchestration: {},
    });
    expect(entry.showToolbarIcon).toBe(false);
  });
});
