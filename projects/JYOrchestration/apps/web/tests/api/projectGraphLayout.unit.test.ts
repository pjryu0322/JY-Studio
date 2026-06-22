import { describe, expect, it } from "vitest";
import {
  filterGraphNodes,
  layoutProjectGraphNodes,
  relatedNodeIds,
} from "@/lib/project-graph/projectGraphLayout";

describe("projectGraphLayout", () => {
  it("assigns positions by node type columns", () => {
    const nodes = [
      { id: "a", nodeType: "Requirement" },
      { id: "b", nodeType: "Feature" },
      { id: "c", nodeType: "Requirement" },
    ];
    const pos = layoutProjectGraphNodes(nodes, 800, 400);
    expect(pos.get("a")).toBeDefined();
    expect(pos.get("b")).toBeDefined();
    expect(pos.get("c")!.y).toBeGreaterThan(pos.get("a")!.y);
    expect(pos.get("a")!.x).not.toBe(pos.get("b")!.x);
  });

  it("filters nodes by search and lifecycle", () => {
    const nodes = [
      { id: "1", nodeType: "Requirement", title: "Login", lifecycleStatus: "APPROVED" },
      { id: "2", nodeType: "Feature", title: "Dashboard", lifecycleStatus: "PROJECTED" },
    ];
    expect(filterGraphNodes(nodes, { search: "login" })).toHaveLength(1);
    expect(filterGraphNodes(nodes, { lifecycle: "PROJECTED" })).toHaveLength(1);
    expect(filterGraphNodes(nodes, { nodeType: "Feature" })).toHaveLength(1);
  });

  it("collects related node ids from edges", () => {
    const edges = [
      { id: "e1", fromNodeId: "a", toNodeId: "b", edgeType: "RELATES" },
      { id: "e2", fromNodeId: "c", toNodeId: "b", edgeType: "RELATES" },
    ];
    expect(relatedNodeIds("b", edges).incoming).toEqual(["a", "c"]);
    expect(relatedNodeIds("a", edges).outgoing).toEqual(["b"]);
  });
});
