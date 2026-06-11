import { describe, expect, it, vi } from "vitest";
import { buildImplementationToolbarQuickHubUi } from "@/lib/prototype/prototypeExecutionImplementationChrome";

describe("prototypeExecutionImplementationChrome", () => {
  it("builds toolbar hub ui without slot chrome fields", () => {
    const onQuick = vi.fn();
    const ui = buildImplementationToolbarQuickHubUi(onQuick);
    expect(ui.readinessPercent).toBe(0);
    expect(ui.covered).toBe(0);
    expect(ui.total).toBe(0);
    expect(ui.orchestrationSlotSections).toBeUndefined();
    expect(ui.statusCounts).toBeUndefined();
    ui.onForceGeneratePlanNow();
    expect(onQuick).toHaveBeenCalledOnce();
  });
});
