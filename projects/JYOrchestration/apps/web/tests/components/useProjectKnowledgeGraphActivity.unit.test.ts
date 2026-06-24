import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadProjectGraphActivitySummary } from "@/lib/project-graph/projectGraphActivityClient";

vi.mock("@/lib/project-graph/projectGraphActivityClient", () => ({
  loadProjectGraphActivitySummary: vi.fn(),
}));

describe("useProjectKnowledgeGraphActivity contract", () => {
  beforeEach(() => {
    vi.mocked(loadProjectGraphActivitySummary).mockReset();
    vi.mocked(loadProjectGraphActivitySummary).mockResolvedValue({ items: [], warnings: [] } as never);
  });

  it("loadProjectGraphActivitySummary accepts sync flag", async () => {
    await loadProjectGraphActivitySummary("p1", { sync: true });
    expect(loadProjectGraphActivitySummary).toHaveBeenCalledWith("p1", { sync: true });
  });
});
