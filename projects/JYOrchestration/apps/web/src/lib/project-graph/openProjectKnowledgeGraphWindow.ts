import { buildKnowledgeGraphHref } from "@/lib/project-graph/projectGraphExploration";
import type { ProjectKnowledgeGraphOpenRequest } from "@/components/project-graph/projectKnowledgeGraphLaunchTypes";

export function openProjectKnowledgeGraphInNewWindow(
  projectId: string,
  input?: Omit<ProjectKnowledgeGraphOpenRequest, "projectId">,
): Window | null {
  if (typeof window === "undefined") return null;
  const pid = String(projectId ?? "").trim();
  if (!pid) return null;
  const href = buildKnowledgeGraphHref(pid, {
    focusNodeId: input?.focusNodeId ?? undefined,
    sourceMessageId: input?.sourceMessageId ?? undefined,
    view: input?.view === "activity" ? "activity" : undefined,
  });
  return window.open(href, "_blank", "noopener,noreferrer");
}
