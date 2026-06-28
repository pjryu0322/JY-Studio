"use client";

import { useUserProjectKnowledgeMemoryControl } from "@/components/project-knowledge/hooks/useUserProjectKnowledgeMemoryControl";

export function useProjectKnowledgeMemoryCompactHint(projectId: string): string | null {
  const { preview, loading } = useUserProjectKnowledgeMemoryControl(projectId);
  if (loading) return null;
  const count = preview?.totalItemCount ?? 0;
  if (count === 0) return "과거 지식: 참조 항목 없음";
  return `과거 지식: 참조 ${count}개 항목`;
}
