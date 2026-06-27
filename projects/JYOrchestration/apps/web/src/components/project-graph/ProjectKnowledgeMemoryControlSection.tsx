"use client";

import { UserProjectKnowledgeMemoryControlPanel } from "@/components/project-knowledge/UserProjectKnowledgeMemoryControlPanel";

export function ProjectKnowledgeMemoryControlSection(p: {
  readonly projectId: string;
  readonly visible: boolean;
}) {
  if (!p.visible) return null;
  return <UserProjectKnowledgeMemoryControlPanel projectId={p.projectId} />;
}
