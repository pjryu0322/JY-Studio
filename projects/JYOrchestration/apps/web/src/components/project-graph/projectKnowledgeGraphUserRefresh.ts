/** User-mode graph surface refresh: graph data + runtime status (via workspace reloadGraph). */
export function runUserKnowledgeGraphRefresh(reloadGraph: () => void | Promise<void>): void {
  void reloadGraph();
}
