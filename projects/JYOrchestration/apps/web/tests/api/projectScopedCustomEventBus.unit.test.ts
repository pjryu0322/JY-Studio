import { describe, expect, it } from "vitest";
import { createProjectScopedCustomEventBus } from "@/lib/ui/projectScopedCustomEventBus";

describe("createProjectScopedCustomEventBus", () => {
  it("exposes dispatch and subscribe helpers", () => {
    const bus = createProjectScopedCustomEventBus<{ readonly open: boolean }>("jyo:test-panel");
    expect(bus.eventName).toBe("jyo:test-panel");
    expect(bus.dispatch("p1", { open: true })).toBeUndefined();
    expect(bus.subscribe("p1", () => {})).toEqual(expect.any(Function));
  });

  it("ignores events for other projects", () => {
    const bus = createProjectScopedCustomEventBus<{ readonly open: boolean }>("jyo:test-panel-filter");
    const seen: boolean[] = [];
    const cleanup = bus.subscribe("p1", (detail) => seen.push(detail.open));
    bus.dispatch("p2", { open: true });
    expect(seen).toEqual([]);
    cleanup();
  });
});
