"use client";

import { Suspense, useCallback, useState } from "react";
import { ProjectKnowledgeGraphModalShell } from "@/components/project-graph/ProjectKnowledgeGraphModalShell";
import { ProjectKnowledgeGraphWorkspace } from "@/components/project-graph/ProjectKnowledgeGraphWorkspace";
import type { ProjectKnowledgeGraphLaunchContext } from "@/components/project-graph/projectKnowledgeGraphLaunchTypes";
import { openProjectKnowledgeGraphInNewWindow } from "@/lib/project-graph/openProjectKnowledgeGraphWindow";
import { uiTokens as t } from "@/components/ui/tokens";

export function ProjectKnowledgeGraphModal(p: {
  readonly open: boolean;
  readonly projectId: string;
  readonly sourceMessageId?: string | null;
  readonly focusNodeId?: string | null;
  readonly view?: "activity" | "graph" | null;
  /** 레일에서 연 modal만 true — 본문 영역에만 overlay */
  readonly preservePlatformRail?: boolean;
  readonly onClose: () => void;
}) {
  const pid = p.projectId.trim();
  const [launchContext, setLaunchContext] = useState<ProjectKnowledgeGraphLaunchContext | null>(null);

  const handleOpenNewWindow = useCallback(() => {
    if (!pid) return;
    const focus =
      String(launchContext?.focusNodeId ?? launchContext?.selectedNodeId ?? p.focusNodeId ?? "").trim() || undefined;
    const source =
      String(launchContext?.sourceMessageId ?? p.sourceMessageId ?? "").trim() || undefined;
    const activity = launchContext?.activityView ?? p.view === "activity";
    openProjectKnowledgeGraphInNewWindow(pid, {
      focusNodeId: focus,
      sourceMessageId: source,
      view: activity ? "activity" : "graph",
    });
  }, [launchContext, p.focusNodeId, p.sourceMessageId, p.view, pid]);

  if (!p.open || !pid) return null;

  return (
    <ProjectKnowledgeGraphModalShell
      open={p.open}
      title="프로젝트 지식 그래프"
      preservePlatformRail={p.preservePlatformRail}
      onClose={p.onClose}
      onOpenNewWindow={handleOpenNewWindow}
    >
      <div
        data-testid="project-knowledge-graph-modal-body"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
      >
        <Suspense fallback={<p style={{ fontSize: 13, color: t.textMuted }}>그래프 UI 준비 중…</p>}>
          <ProjectKnowledgeGraphWorkspace
            projectId={pid}
            variant="modal"
            initialSourceMessageId={p.sourceMessageId ?? null}
            onLaunchContextChange={setLaunchContext}
          />
        </Suspense>
      </div>
    </ProjectKnowledgeGraphModalShell>
  );
}
