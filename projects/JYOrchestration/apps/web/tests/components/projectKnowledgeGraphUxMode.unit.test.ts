import { describe, expect, it } from "vitest";
import {
  knowledgeGraphPaneTitle,
  knowledgeGraphTabsUseDiagnosticLabels,
  knowledgeGraphTabsVisible,
} from "@/components/project-graph/projectKnowledgeGraphUxMode";

describe("projectKnowledgeGraphUxMode", () => {
  it("shows tabs only in diagnostic mode or when user diagnostics are open", () => {
    expect(knowledgeGraphTabsVisible({ mode: "user", diagnosticsOpen: false })).toBe(false);
    expect(knowledgeGraphTabsVisible({ mode: "user", diagnosticsOpen: true })).toBe(true);
    expect(knowledgeGraphTabsVisible({ mode: "diagnostic", diagnosticsOpen: false })).toBe(true);
  });

  it("uses English tab labels only in diagnostic mode", () => {
    expect(knowledgeGraphTabsUseDiagnosticLabels("user")).toBe(false);
    expect(knowledgeGraphTabsUseDiagnosticLabels("diagnostic")).toBe(true);
  });

  it("maps pane titles for user navigation", () => {
    expect(knowledgeGraphPaneTitle("activity")).toBe("변경 로그");
    expect(knowledgeGraphPaneTitle("knowledge")).toBe("생성 과정");
    expect(knowledgeGraphPaneTitle("diagnostic")).toBe("진단 정보");
  });
});
