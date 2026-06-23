import { describe, expect, it, vi } from "vitest";
import { buildKnowledgeGraphHref } from "@/lib/project-graph/projectGraphExploration";
import { openProjectKnowledgeGraphInNewWindow } from "@/lib/project-graph/openProjectKnowledgeGraphWindow";

describe("openProjectKnowledgeGraphInNewWindow", () => {
  it("opens href with focus, source, and activity view", () => {
    const open = vi.fn().mockReturnValue({} as Window);
    vi.stubGlobal("window", { open });

    openProjectKnowledgeGraphInNewWindow("p1", {
      focusNodeId: "node-1",
      sourceMessageId: "msg-9",
      view: "activity",
    });

    expect(open).toHaveBeenCalledWith(
      buildKnowledgeGraphHref("p1", {
        focusNodeId: "node-1",
        sourceMessageId: "msg-9",
        view: "activity",
      }),
      "_blank",
      "noopener,noreferrer",
    );
    vi.unstubAllGlobals();
  });
});

describe("buildKnowledgeGraphHref view param", () => {
  it("includes view query when set", () => {
    expect(buildKnowledgeGraphHref("p1", { view: "activity" })).toBe(
      "/projects/p1/knowledge-graph?view=activity",
    );
  });
});
