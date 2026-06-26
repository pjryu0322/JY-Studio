import { describe, expect, it } from "vitest";
import {
  knowledgeGraphPaneTitle,
  shouldShowKnowledgeGraphDiagnostics,
} from "@/components/project-graph/projectKnowledgeGraphUxMode";

describe("projectKnowledgeGraphUxMode", () => {
  it("hides diagnostic tabs unless dev mode", () => {
    expect(shouldShowKnowledgeGraphDiagnostics({ devMode: false })).toBe(false);
    expect(shouldShowKnowledgeGraphDiagnostics({ devMode: true })).toBe(true);
  });

  it("maps pane titles for user navigation", () => {
    expect(knowledgeGraphPaneTitle("activity")).toBe("변경 로그");
    expect(knowledgeGraphPaneTitle("knowledge")).toBe("생성 과정");
  });
});
