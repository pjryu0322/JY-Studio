import { describe, expect, it } from "vitest";

import { prioritizeOverlayContexts } from "@/lib/overlay/overlayContextPrioritization";
import { buildOverlaySelectedContextRefs } from "@/lib/overlay/overlayContextSelection";

const refs = buildOverlaySelectedContextRefs({
  roleKey: "planner",
  memoryScopes: ["platform"],
  knowledgeHints: ["pack1"],
  timelineEnabled: true,
  workspaceScreenKey: "design.canvas",
  policyHintSource: "planner",
});

describe("prioritizeOverlayContexts", () => {
  it("compact policy: role/policy/memory come before timeline/workspace", () => {
    const sorted = prioritizeOverlayContexts({ contexts: refs, budgetPolicy: "compact" });
    const types = sorted.map((r) => r.type);
    const timelineIdx = types.indexOf("timeline");
    const workspaceIdx = types.indexOf("workspace");
    const memoryIdx = types.indexOf("memory");
    const policyIdx = types.indexOf("policy");
    expect(types[0]).toBe("role");
    expect(policyIdx).toBeLessThan(timelineIdx);
    expect(memoryIdx).toBeLessThan(timelineIdx);
    expect(workspaceIdx).toBeLessThan(timelineIdx);
  });

  it("extended policy: timeline/workspace rise above default knowledge", () => {
    const sorted = prioritizeOverlayContexts({ contexts: refs, budgetPolicy: "extended" });
    const types = sorted.map((r) => r.type);
    const knowledgeIdx = types.indexOf("knowledge");
    const timelineIdx = types.indexOf("timeline");
    const workspaceIdx = types.indexOf("workspace");
    expect(types[0]).toBe("role");
    expect(timelineIdx).toBeLessThan(knowledgeIdx);
    expect(workspaceIdx).toBeLessThan(knowledgeIdx);
  });

  it("does not mutate input array", () => {
    const before = refs.map((r) => r.type).join(",");
    prioritizeOverlayContexts({ contexts: refs, budgetPolicy: "compact" });
    const after = refs.map((r) => r.type).join(",");
    expect(after).toBe(before);
  });
});
