import { describe, expect, it, vi } from "vitest";
import { runUserKnowledgeGraphRefresh } from "@/components/project-graph/projectKnowledgeGraphUserRefresh";

describe("runUserKnowledgeGraphRefresh", () => {
  it("invokes reloadGraph when user refresh runs", async () => {
    const reloadGraph = vi.fn(async () => {});
    runUserKnowledgeGraphRefresh(reloadGraph);
    expect(reloadGraph).toHaveBeenCalledTimes(1);
  });
});
