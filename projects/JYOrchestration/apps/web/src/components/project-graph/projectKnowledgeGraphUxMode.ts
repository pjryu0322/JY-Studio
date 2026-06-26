export type ProjectKnowledgeGraphUxMode = "user" | "diagnostic";

/** @deprecated Use ProjectKnowledgeGraphUxMode */
export type KnowledgeGraphUxMode = ProjectKnowledgeGraphUxMode;

export function knowledgeGraphTabsVisible(input: {
  readonly mode: ProjectKnowledgeGraphUxMode;
  readonly diagnosticsOpen: boolean;
}): boolean {
  if (input.mode === "diagnostic") return true;
  return input.diagnosticsOpen;
}

export function knowledgeGraphTabsUseDiagnosticLabels(mode: ProjectKnowledgeGraphUxMode): boolean {
  return mode === "diagnostic";
}

export function knowledgeGraphPaneTitle(pane: "graph" | "activity" | "knowledge" | "diagnostic"): string {
  switch (pane) {
    case "graph":
      return "프로젝트 구조";
    case "activity":
      return "변경 로그";
    case "knowledge":
      return "생성 과정";
    case "diagnostic":
      return "진단 정보";
  }
}

export function isKnowledgeGraphUserSurface(mode: ProjectKnowledgeGraphUxMode): boolean {
  return mode === "user";
}
