export type KnowledgeGraphUxMode = "user" | "diagnostic";

export function shouldShowKnowledgeGraphDiagnostics(input: {
  readonly devMode: boolean;
}): boolean {
  return input.devMode;
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
      return "개발자 진단";
  }
}
