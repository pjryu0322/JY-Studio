import type { ProjectKnowledgeGraphPane } from "@/components/project-graph/projectKnowledgeGraphWorkspaceTypes";

export function knowledgeGraphPaneFromViewQuery(view: string | null | undefined): ProjectKnowledgeGraphPane {
  return String(view ?? "").trim() === "activity" ? "activity" : "graph";
}

export function knowledgeGraphSyncOnEntry(input: {
  readonly clientReady: boolean;
  readonly isModal: boolean;
  readonly syncQuery: string | null | undefined;
}): boolean {
  return input.clientReady && (input.isModal || String(input.syncQuery ?? "").trim() === "true");
}

export function knowledgeGraphHighlightSourceMessageId(input: {
  readonly clientReady: boolean;
  readonly initialSourceMessageId?: string | null;
  readonly sourceMessageIdQuery?: string | null;
}): string | null {
  if (!input.clientReady) return null;
  const id = String(input.initialSourceMessageId ?? input.sourceMessageIdQuery ?? "").trim();
  return id || null;
}

export function knowledgeGraphTraceNodeIdFromQuery(
  clientReady: boolean,
  traceNodeIdQuery: string | null | undefined,
): string | null {
  if (!clientReady) return null;
  const id = String(traceNodeIdQuery ?? "").trim();
  return id || null;
}
