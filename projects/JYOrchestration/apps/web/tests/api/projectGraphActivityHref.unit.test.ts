import { describe, expect, it } from "vitest";
import { buildProjectKnowledgeGraphActivityHref } from "@/lib/project-graph/projectGraphActivityHref";

describe("buildProjectKnowledgeGraphActivityHref", () => {
  it("builds activity URL with sync", () => {
    const href = buildProjectKnowledgeGraphActivityHref("proj-1");
    expect(href).toBe("/projects/proj-1/knowledge-graph?view=activity&sync=true");
  });

  it("includes sourceMessageId when provided", () => {
    const href = buildProjectKnowledgeGraphActivityHref("proj-1", "msg-9");
    expect(href).toContain("sourceMessageId=msg-9");
    expect(href).toContain("view=activity");
  });
});
