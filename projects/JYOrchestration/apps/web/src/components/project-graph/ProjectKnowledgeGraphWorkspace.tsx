"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { uiTokens as t } from "@/components/ui/tokens";
import { ProjectKnowledgeGraphTabs } from "@/components/project-graph/ProjectKnowledgeGraphTabs";
import { ProjectKnowledgeGraphExplorerPane } from "@/components/project-graph/ProjectKnowledgeGraphExplorerPane";
import { ProjectKnowledgeGraphActivityPane } from "@/components/project-graph/ProjectKnowledgeGraphActivityPane";
import { ProjectKnowledgeGraphKnowledgeActivityPane } from "@/components/project-graph/ProjectKnowledgeGraphKnowledgeActivityPane";
import { ProjectKnowledgeGraphUserNavBar } from "@/components/project-graph/ProjectKnowledgeGraphUserNavBar";
import { useProjectKnowledgeGraphData } from "@/components/project-graph/hooks/useProjectKnowledgeGraphData";
import { useProjectKnowledgeGraphExplorerState } from "@/components/project-graph/hooks/useProjectKnowledgeGraphExplorerState";
import { useProjectKnowledgeGraphActivity } from "@/components/project-graph/hooks/useProjectKnowledgeGraphActivity";
import { useProjectKnowledgePipelineRuns } from "@/components/project-graph/hooks/useProjectKnowledgePipelineRuns";
import { useProjectKnowledgeRuntimeStatus } from "@/components/project-graph/hooks/useProjectKnowledgeRuntimeStatus";
import type { ProjectKnowledgeGraphPane } from "@/components/project-graph/projectKnowledgeGraphWorkspaceTypes";
import type { ProjectKnowledgeGraphLaunchContext } from "@/components/project-graph/projectKnowledgeGraphLaunchTypes";
import {
  isKnowledgeGraphUserSurface,
  knowledgeGraphTabsVisible,
  type ProjectKnowledgeGraphUxMode,
} from "@/components/project-graph/projectKnowledgeGraphUxMode";
import {
  knowledgeGraphHighlightSourceMessageId,
  knowledgeGraphPaneFromViewQuery,
  knowledgeGraphSyncOnEntry,
} from "@/components/project-graph/projectKnowledgeGraphWorkspaceQuery";

export function ProjectKnowledgeGraphWorkspace({
  projectId,
  variant = "page",
  uxMode = "user",
  initialSourceMessageId = null,
  onExit,
  onLaunchContextChange,
}: {
  readonly projectId: string;
  readonly variant?: "page" | "modal";
  readonly uxMode?: ProjectKnowledgeGraphUxMode;
  readonly initialSourceMessageId?: string | null;
  readonly onExit?: () => void;
  readonly onLaunchContextChange?: (ctx: ProjectKnowledgeGraphLaunchContext) => void;
}) {
  const searchParams = useSearchParams();
  const [clientReady, setClientReady] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const isModal = variant === "modal";
  const viewMode = clientReady ? String(searchParams?.get("view") ?? "").trim() : "";
  const [workspacePane, setWorkspacePane] = useState<ProjectKnowledgeGraphPane>("graph");
  const userSurface = isKnowledgeGraphUserSurface(uxMode);
  const tabsVisible = knowledgeGraphTabsVisible({ mode: uxMode, diagnosticsOpen });

  useEffect(() => {
    if (!clientReady) return;
    const pane = knowledgeGraphPaneFromViewQuery(viewMode);
    setWorkspacePane(pane);
    if (pane !== "graph") {
      setDiagnosticsOpen(true);
    }
  }, [clientReady, viewMode]);

  const activityView = workspacePane === "activity" || workspacePane === "diagnostic";
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

  const {
    summary: runtimeStatusSummary,
    loading: runtimeStatusLoading,
    error: runtimeStatusError,
    reload: reloadRuntimeStatus,
  } = useProjectKnowledgeRuntimeStatus(projectId, clientReady);

  const activityUserMode = userSurface && workspacePane === "activity";

  useEffect(() => {
    if (!onLaunchContextChange) return;
    onLaunchContextChange({
      focusNodeId: explorer.focusNodeId,
      selectedNodeId: explorer.selectedNodeId,
      activityView: workspacePane === "activity",
      sourceMessageId: highlightSourceMessageId,
    });
  }, [
    onLaunchContextChange,
    explorer.focusNodeId,
    explorer.selectedNodeId,
    workspacePane,
    highlightSourceMessageId,
  ]);

  const openDiagnosticsSurface = () => setDiagnosticsOpen(true);

  const openActivityPane = () => {
    openDiagnosticsSurface();
    setWorkspacePane("activity");
    void reloadActivity(true);
  };

  const openKnowledgePane = () => {
    openDiagnosticsSurface();
    setWorkspacePane("knowledge");
    void reloadPipelineMonitor();
  };

  const openDiagnosticPane = () => {
    openDiagnosticsSurface();
    setWorkspacePane("diagnostic");
    void reloadActivity(true);
    void reloadPipelineMonitor();
  };

  const goToGraph = () => {
    setWorkspacePane("graph");
    setDiagnosticsOpen(false);
  };

  const showUserTitle = userSurface && workspacePane === "graph" && !tabsVisible;
  const showUserNav =
    userSurface &&
    workspacePane !== "graph" &&
    (workspacePane === "diagnostic" || !tabsVisible);

  return (
    <div
      data-testid="project-knowledge-graph-workspace"
      data-knowledge-graph-ux-mode={uxMode}
      style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      <ProjectKnowledgeGraphTabs
        activePane={workspacePane}
        onPaneChange={(pane) => {
          if (pane === "knowledge") {
            void reloadPipelineMonitor();
          }
          if (pane === "activity") {
            void reloadActivity(true);
          }
          setWorkspacePane(pane);
        }}
        onKnowledgePaneSelect={() => void reloadPipelineMonitor()}
        mode={uxMode}
        diagnosticsOpen={diagnosticsOpen}
      />
      {showUserTitle ? (
        <div
          data-testid="project-knowledge-graph-user-title"
          style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary, padding: "0 0 8px", flexShrink: 0 }}
        >
          프로젝트 구조
        </div>
      ) : null}
      {showUserNav ? (
        <ProjectKnowledgeGraphUserNavBar pane={workspacePane} onBack={goToGraph} />
      ) : null}
      {workspacePane === "knowledge" ? (
        <ProjectKnowledgeGraphKnowledgeActivityPane
          runs={pipelineRuns}
          loading={pipelineLoading}
          error={pipelineError}
          onRefresh={() => void reloadPipelineMonitor()}
          traceNodeId={explorer.detailNodeId ?? explorer.selectedNodeId}
          traceNodeTitle={explorer.selectedNode?.title ?? explorer.detailNode?.title ?? null}
          onOpenTrace={(nodeId) => {
            explorer.openTraceForNode(nodeId);
            setWorkspacePane("graph");
            setDiagnosticsOpen(false);
          }}
          userMode={userSurface}
          onShowDiagnostics={userSurface ? openDiagnosticPane : undefined}
        />
      ) : workspacePane === "diagnostic" ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <ProjectKnowledgeGraphActivityPane
            projectId={projectId}
            summary={activitySummary}
            loading={activityLoading}
            error={activityError}
            highlightSourceMessageId={highlightSourceMessageId}
            userMode={false}
            onRefresh={() => {
              void reloadActivity(true);
              void reload();
            }}
          />
          <ProjectKnowledgeGraphKnowledgeActivityPane
            runs={pipelineRuns}
            loading={pipelineLoading}
            error={pipelineError}
            onRefresh={() => void reloadPipelineMonitor()}
            userMode={false}
          />
        </div>
      ) : activityView ? (
        <ProjectKnowledgeGraphActivityPane
          projectId={projectId}
          summary={activitySummary}
          loading={activityLoading}
          error={activityError}
          highlightSourceMessageId={highlightSourceMessageId}
          userMode={activityUserMode}
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
          reloadGraph={async () => {
            await reload();
            await reloadRuntimeStatus();
          }}
          variant={variant}
          onExit={onExit}
          explorerState={explorer}
          runtimeStatusSummary={runtimeStatusSummary}
          runtimeStatusLoading={runtimeStatusLoading}
          runtimeStatusError={runtimeStatusError}
          onReloadRuntimeStatus={() => void reloadRuntimeStatus()}
          onOpenChangeLog={openActivityPane}
          onOpenKnowledgeLog={openKnowledgePane}
          onOpenDiagnosticLog={userSurface ? openDiagnosticPane : undefined}
          uxMode={uxMode}
        />
      )}
    </div>
  );
}
