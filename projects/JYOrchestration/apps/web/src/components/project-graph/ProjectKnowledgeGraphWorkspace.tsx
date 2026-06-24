"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectKnowledgeGraphTabs } from "@/components/project-graph/ProjectKnowledgeGraphTabs";
import { ProjectKnowledgeGraphExplorerPane } from "@/components/project-graph/ProjectKnowledgeGraphExplorerPane";
import { ProjectKnowledgeGraphActivityPane } from "@/components/project-graph/ProjectKnowledgeGraphActivityPane";
import { ProjectKnowledgeGraphKnowledgeActivityPane } from "@/components/project-graph/ProjectKnowledgeGraphKnowledgeActivityPane";
import { useProjectKnowledgeGraphData } from "@/components/project-graph/hooks/useProjectKnowledgeGraphData";
import { useProjectKnowledgeGraphExplorerState } from "@/components/project-graph/hooks/useProjectKnowledgeGraphExplorerState";
import { useProjectKnowledgeGraphActivity } from "@/components/project-graph/hooks/useProjectKnowledgeGraphActivity";
import { useProjectKnowledgePipelineRuns } from "@/components/project-graph/hooks/useProjectKnowledgePipelineRuns";
import type { ProjectKnowledgeGraphPane } from "@/components/project-graph/projectKnowledgeGraphWorkspaceTypes";
import type { ProjectKnowledgeGraphLaunchContext } from "@/components/project-graph/projectKnowledgeGraphLaunchTypes";
import {
  knowledgeGraphHighlightSourceMessageId,
  knowledgeGraphPaneFromViewQuery,
  knowledgeGraphSyncOnEntry,
} from "@/components/project-graph/projectKnowledgeGraphWorkspaceQuery";

export function ProjectKnowledgeGraphWorkspace({
  projectId,
  variant = "page",
  initialSourceMessageId = null,
  onExit,
  onLaunchContextChange,
}: {
  readonly projectId: string;
  readonly variant?: "page" | "modal";
  readonly initialSourceMessageId?: string | null;
  readonly onExit?: () => void;
  readonly onLaunchContextChange?: (ctx: ProjectKnowledgeGraphLaunchContext) => void;
}) {
  const searchParams = useSearchParams();
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);

  const isModal = variant === "modal";
  const viewMode = clientReady ? String(searchParams?.get("view") ?? "").trim() : "";
  const [workspacePane, setWorkspacePane] = useState<ProjectKnowledgeGraphPane>("graph");

  useEffect(() => {
    if (!clientReady) return;
    setWorkspacePane(knowledgeGraphPaneFromViewQuery(viewMode));
  }, [clientReady, viewMode]);

  const activityView = workspacePane === "activity";
  const syncOnEntry = knowledgeGraphSyncOnEntry({
    clientReady,
    isModal,
    syncQuery: searchParams?.get("sync"),
  });
  const highlightSourceMessageId = knowledgeGraphHighlightSourceMessageId({
    clientReady,
    initialSourceMessageId,
    sourceMessageIdQuery: searchParams?.get("sourceMessageId"),
  });

  const { nodes, edges, loading, error, reload } = useProjectKnowledgeGraphData({
    projectId,
    clientReady,
    syncOnEntry,
  });

  const explorer = useProjectKnowledgeGraphExplorerState({
    nodes,
    edges,
    clientReady,
    searchParams,
    reloadGraph: reload,
  });

  const { activitySummary, activityLoading, activityError, reloadActivity } = useProjectKnowledgeGraphActivity({
    projectId,
    clientReady,
    enabled: activityView,
    syncOnEntry,
  });

  const { pipelineRuns, pipelineLoading, pipelineError, reloadPipelineMonitor } =
    useProjectKnowledgePipelineRuns(projectId);

  useEffect(() => {
    if (!onLaunchContextChange) return;
    onLaunchContextChange({
      focusNodeId: explorer.focusNodeId,
      selectedNodeId: explorer.selectedNodeId,
      activityView,
      sourceMessageId: highlightSourceMessageId,
    });
  }, [
    onLaunchContextChange,
    explorer.focusNodeId,
    explorer.selectedNodeId,
    activityView,
    highlightSourceMessageId,
  ]);

  return (
    <div
      data-testid="project-knowledge-graph-workspace"
      style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      <ProjectKnowledgeGraphTabs
        activePane={workspacePane}
        onPaneChange={setWorkspacePane}
        onKnowledgePaneSelect={() => void reloadPipelineMonitor()}
      />
      {workspacePane === "knowledge" ? (
        <ProjectKnowledgeGraphKnowledgeActivityPane
          runs={pipelineRuns}
          loading={pipelineLoading}
          error={pipelineError}
          onRefresh={() => void reloadPipelineMonitor()}
          traceNodeId={explorer.detailNodeId ?? explorer.selectedNodeId}
          onOpenTrace={(nodeId) => {
            explorer.openTraceForNode(nodeId);
            setWorkspacePane("graph");
          }}
        />
      ) : activityView ? (
        <ProjectKnowledgeGraphActivityPane
          projectId={projectId}
          summary={activitySummary}
          loading={activityLoading}
          error={activityError}
          highlightSourceMessageId={highlightSourceMessageId}
          onRefresh={() => {
            void reloadActivity(true);
            void reload();
          }}
        />
      ) : (
        <ProjectKnowledgeGraphExplorerPane
          projectId={projectId}
          clientReady={clientReady}
          searchParams={searchParams}
          nodes={nodes}
          edges={edges}
          loading={loading}
          error={error}
          reloadGraph={reload}
          variant={variant}
          onExit={onExit}
          explorerState={explorer}
        />
      )}
    </div>
  );
}
