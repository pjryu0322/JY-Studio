import { describe, expect, it } from "vitest";
import {
  buildOverlaySelectedContextRefs,
  parseOverlaySelectedContextRefsFromUnknown,
  summarizeOverlaySelectedContextRefs,
  OVERLAY_SELECTED_CONTEXT_REFS_MAX,
} from "@/lib/overlay/overlayContextSelection";

describe("buildOverlaySelectedContextRefs", () => {
  it("builds role/memory/knowledge/timeline/workspace/policy refs in priority order", () => {
    const refs = buildOverlaySelectedContextRefs({
      roleKey: "planner",
      memoryScopes: ["platform", "role"],
      knowledgeHints: ["pack1", "pack2"],
      timelineEnabled: true,
      workspaceScreenKey: "design.canvas",
      policyHintSource: "planner",
    });

    expect(refs.find((r) => r.type === "role")?.priority).toBe(0);
    expect(refs.filter((r) => r.type === "memory").map((r) => r.priority)).toEqual([10, 11]);
    expect(refs.filter((r) => r.type === "knowledge").map((r) => r.priority)).toEqual([20, 21]);
    expect(refs.find((r) => r.type === "timeline")?.priority).toBe(30);
    expect(refs.find((r) => r.type === "workspace")?.source).toBe("design.canvas");
    expect(refs.find((r) => r.type === "policy")?.source).toBe("planner");
  });

  it("skips role/memory/knowledge entries when inputs are empty or blank", () => {
    const refs = buildOverlaySelectedContextRefs({
      roleKey: "   ",
      memoryScopes: ["", "  "],
      knowledgeHints: [],
      timelineEnabled: false,
    });
    expect(refs).toEqual([]);
  });

  it("survives invalid input safely (no throw)", () => {
    expect(() =>
      buildOverlaySelectedContextRefs({
        roleKey: null,
        memoryScopes: [],
        knowledgeHints: [],
      })
    ).not.toThrow();
  });
});

describe("parseOverlaySelectedContextRefsFromUnknown", () => {
  it("drops rows missing type/source/reason and caps to MAX", () => {
    const raw = [
      { type: "memory", source: "m", reason: "r", priority: 1 },
      { type: "bogus", source: "x", reason: "x", priority: 1 },
      { type: "role", source: "", reason: "r", priority: 0 },
      { type: "knowledge", source: "k", reason: "" },
      ...new Array(OVERLAY_SELECTED_CONTEXT_REFS_MAX + 5).fill({
        type: "policy",
        source: "p",
        reason: "y",
        priority: 1,
      }),
    ];
    const parsed = parseOverlaySelectedContextRefsFromUnknown(raw);
    expect(parsed.length).toBeLessThanOrEqual(OVERLAY_SELECTED_CONTEXT_REFS_MAX);
    expect(parsed.find((r) => r.type === "memory")?.source).toBe("m");
    expect(parsed.find((r) => r.type === "knowledge")).toBeUndefined();
  });

  it("returns [] when not an array", () => {
    expect(parseOverlaySelectedContextRefsFromUnknown(null)).toEqual([]);
    expect(parseOverlaySelectedContextRefsFromUnknown("string")).toEqual([]);
  });
});

describe("summarizeOverlaySelectedContextRefs", () => {
  it("counts per-type buckets", () => {
    const refs = buildOverlaySelectedContextRefs({
      roleKey: "planner",
      memoryScopes: ["platform"],
      knowledgeHints: ["pack1"],
      timelineEnabled: true,
      workspaceScreenKey: "ws",
      policyHintSource: "planner",
    });
    const sum = summarizeOverlaySelectedContextRefs(refs);
    expect(sum.selectedContextCount).toBe(refs.length);
    expect(sum.roleCount).toBe(1);
    expect(sum.memoryCount).toBe(1);
    expect(sum.knowledgeHintCount).toBe(1);
    expect(sum.timelineCount).toBe(1);
    expect(sum.workspaceCount).toBe(1);
    expect(sum.policyCount).toBe(1);
  });
});
