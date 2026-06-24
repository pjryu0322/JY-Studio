"use client";

import { useState, type CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { ProjectKnowledgeGraphCanvas } from "@/components/project-graph/ProjectKnowledgeGraphCanvas";
import { FixedToast } from "@/components/ui/FixedToast";
import { ProjectGraphContextMenu } from "@/components/project-graph/ProjectGraphContextMenu";
import { ProjectGraphNodeActionSheet } from "@/components/project-graph/ProjectGraphNodeActionSheet";
import { ProjectKnowledgeGraphNodeBottomSheet } from "@/components/project-graph/ProjectKnowledgeGraphNodeBottomSheet";
import { ProjectGraphNodeDetailPanel } from "@/components/project-graph/ProjectGraphNodeDetailPanel";
import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import { requirementsWorkspaceMainRowStyle } from "@/components/requirements/requirementsWorkspaceLayoutStyles";
import {
  type ProjectKnowledgeGraphExplorerState,
} from "@/components/project-graph/hooks/useProjectKnowledgeGraphExplorerState";
import { ProjectKnowledgeReplayModal } from "@/components/project-graph/ProjectKnowledgeReplayModal";
import type { ReadonlyURLSearchParams } from "next/navigation";

const LIFECYCLE_OPTIONS = ["", "PROJECTED", "APPROVED", "CANDIDATE"] as const;

const QUESTION_HINTS = [
  "왜 생성되었는가?",
  "어떤 대화에서 생성되었는가?",
  "어떤 기능과 연결되는가?",
  "어떤 화면에 영향을 주는가?",
  "어떤 Review가 존재하는가?",
] as const;

export function ProjectKnowledgeGraphExplorerPane(p: {
  readonly projectId: string;
  readonly clientReady: boolean;
  readonly searchParams: ReadonlyURLSearchParams | null;
  readonly nodes: readonly ProjectGraphNodeDto[];
  readonly edges: readonly ProjectGraphEdgeDto[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly reloadGraph: () => Promise<void>;
  readonly variant: "page" | "modal";
  readonly onExit?: () => void;
  readonly explorerState: ProjectKnowledgeGraphExplorerState;
}) {
  const { effectiveLayout } = useWorkspaceMode();
  const isMobileLayout = p.clientReady && effectiveLayout === "MOBILE";
  const isModal = p.variant === "modal";
  const ex = p.explorerState;
  const [replayOpen, setReplayOpen] = useState(false);

  const shell: CSSProperties = {
    ...requirementsWorkspaceMainRowStyle,
    display: "flex",
    flexDirection: ex.graphMobileUx || isMobileLayout ? "column" : "row",
    flex: 1,
    minHeight: 0,
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    overflow: "hidden",
    background: t.bgPage,
  };

  const toolbar: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "10px 12px",
    borderBottom: `1px solid ${t.border}`,
    alignItems: "center",
  };

  const inputStyle: CSSProperties = {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    minWidth: 120,
  };

  const btnStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    padding: ex.graphMobileUx ? "10px 12px" : "6px 10px",
    minHeight: ex.graphMobileUx ? 44 : undefined,
    minWidth: ex.graphMobileUx ? 44 : undefined,
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.bgPage,
    cursor: "pointer",
  };

  const canvasHeight = ex.graphMobileUx ? 400 : 520;
  const canvasWidth = 960;

  return (
    <div
      data-testid="project-knowledge-graph-explorer-pane"
      style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      {ex.toastMessage ? (
        <FixedToast tone="success" aria-live="polite">
          {ex.toastMessage}
        </FixedToast>
      ) : null}
      <div style={toolbar}>
        <div
          style={{
            flex: "1 1 100%",
            fontSize: 12,
            fontWeight: 700,
            color: ex.selectedNode ? t.textPrimary : t.textMuted,
          }}
          aria-live="polite"
        >
          {ex.selectedNode ? `현재 선택: ${ex.selectedNode.title}` : "선택된 노드 없음"}
        </div>
        <input
          type="search"
          placeholder="노드·질문 검색 (예: 왜 생성되었는가?)"
          value={ex.search}
          onChange={(e) => ex.setSearch(e.target.value)}
          list="graph-question-hints"
          style={{ ...inputStyle, flex: "1 1 200px", maxWidth: 360 }}
          aria-label="그래프 질문 검색"
        />
        <datalist id="graph-question-hints">
          {QUESTION_HINTS.map((q) => (
            <option key={q} value={q} />
          ))}
        </datalist>
        <select
          value={ex.nodeTypeFilter}
          onChange={(e) => ex.setNodeTypeFilter(e.target.value)}
          style={inputStyle}
          aria-label="노드 타입 필터"
        >
          <option value="">모든 타입</option>
          {ex.nodeTypes.map((nt) => (
            <option key={nt} value={nt}>
              {nt}
            </option>
          ))}
        </select>
        <select
          value={ex.lifecycleFilter}
          onChange={(e) => ex.setLifecycleFilter(e.target.value)}
          style={inputStyle}
          aria-label="라이프사이클 필터"
        >
          {LIFECYCLE_OPTIONS.map((opt) => (
            <option key={opt || "all"} value={opt}>
              {opt || "모든 상태"}
            </option>
          ))}
        </select>
        {!ex.graphMobileUx ? (
          <button
            type="button"
            onClick={() => ex.setDetailPanelOpen((v) => !v)}
            aria-pressed={ex.detailPanelOpen}
            style={btnStyle}
          >
            {ex.detailPanelOpen ? "상세 숨기기" : "상세 보기"}
          </button>
        ) : null}
        <button
          type="button"
          data-testid="knowledge-replay-open"
          onClick={() => setReplayOpen(true)}
          style={{ ...btnStyle, fontWeight: 800, color: t.primary }}
        >
          그래프 변화 보기
        </button>
        <span style={{ fontSize: 11, color: t.textMuted }}>
          {ex.filteredNodes.length} nodes · {ex.filteredEdges.length} edges
          {ex.explorationQuery.kind === "question" ? " · 질문 모드" : ""}
        </span>
      </div>

      {p.error ? <p style={{ padding: 12, margin: 0, color: "#b91c1c", fontSize: 13 }}>{p.error}</p> : null}
      {p.loading ? (
        <p style={{ padding: 12, margin: 0, color: t.textMuted, fontSize: 13 }}>그래프 불러오는 중…</p>
      ) : null}

      <div style={shell}>
        <div
          style={{
            flex: ex.graphMobileUx ? "7 1 0%" : "6 1 0%",
            minWidth: 0,
            minHeight: ex.graphMobileUx ? 420 : 520,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <ProjectKnowledgeGraphCanvas
            nodes={ex.filteredNodes}
            edges={ex.filteredEdges}
            selectedNodeId={ex.selectedNodeId}
            selectedEdgeId={ex.selectedEdgeId}
            highlightNodeIds={ex.explored.highlightIds}
            impactZones={ex.selectionImpact}
            onSelectNode={ex.handleSelectNode}
            onOpenNodeDetail={ex.handleOpenNodeDetail}
            onSelectEdge={ex.setSelectedEdgeId}
            width={canvasWidth}
            height={canvasHeight}
            centerOnNodeRequest={ex.centerOnNodeRequest}
            treeLayoutRootId={ex.treeLayoutRootId}
            viewResetNonce={ex.viewResetNonce}
            enableLongPressMenu={ex.graphMobileUx}
            onNodeContextMenu={ex.contextMenu.openNodeMenu}
            onCanvasContextMenu={ex.contextMenu.openCanvasMenu}
            onNodeLongPress={ex.contextMenu.openNodeActionSheet}
            onCanvasLongPress={ex.contextMenu.openCanvasMenu}
          />
          <ProjectGraphContextMenu
            open={ex.contextMenu.menu.open && ex.contextMenu.menu.kind === "node"}
            x={ex.contextMenu.menu.open && ex.contextMenu.menu.kind === "node" ? ex.contextMenu.menu.x : 0}
            y={ex.contextMenu.menu.open && ex.contextMenu.menu.kind === "node" ? ex.contextMenu.menu.y : 0}
            items={ex.nodeContextMenuItems}
            ariaLabel="노드 작업 메뉴"
            onClose={ex.contextMenu.close}
          />
          <ProjectGraphContextMenu
            open={ex.contextMenu.menu.open && ex.contextMenu.menu.kind === "canvas"}
            x={ex.contextMenu.menu.open && ex.contextMenu.menu.kind === "canvas" ? ex.contextMenu.menu.x : 0}
            y={ex.contextMenu.menu.open && ex.contextMenu.menu.kind === "canvas" ? ex.contextMenu.menu.y : 0}
            items={ex.canvasMenuItems}
            ariaLabel="캔버스 작업 메뉴"
            onClose={ex.contextMenu.close}
          />
          {ex.graphMobileUx ? (
            <ProjectGraphNodeActionSheet
              open={Boolean(ex.actionSheetNode)}
              nodeTitle={ex.actionSheetNode?.title ?? "노드"}
              items={ex.actionSheetNode ? ex.buildMobileNodeMenuItems(ex.actionSheetNode.id) : []}
              onClose={ex.contextMenu.close}
            />
          ) : null}
          {ex.graphMobileUx ? (
            <ProjectKnowledgeGraphNodeBottomSheet
              open={Boolean(ex.detailNode)}
              projectId={p.projectId}
              node={ex.detailNode}
              impact={ex.detailImpact}
              detailTab={ex.detailTab}
              onDetailTabChange={ex.setDetailTab}
              onClose={ex.closeMobileNodeSheet}
              onSelectRelatedNodeId={ex.handleSelectRelatedNodeId}
            />
          ) : null}
          {ex.selectedEdge ? (
            <div
              style={{ padding: "8px 12px", borderTop: `1px solid ${t.border}`, fontSize: 12, color: t.textSecondary }}
            >
              <strong>선택된 관계:</strong> {ex.selectedEdge.edgeType} ·{" "}
              {ex.nodeTitleById.get(ex.selectedEdge.fromNodeId) ?? ex.selectedEdge.fromNodeId} →{" "}
              {ex.nodeTitleById.get(ex.selectedEdge.toNodeId) ?? ex.selectedEdge.toNodeId}
            </div>
          ) : null}
        </div>
        {!ex.graphMobileUx && ex.detailPanelOpen ? (
          <ProjectGraphNodeDetailPanel
            projectId={p.projectId}
            node={ex.detailNode}
            impact={ex.detailImpact}
            onSelectRelatedNodeId={ex.handleSelectRelatedNodeId}
            detailTab={ex.detailTab}
            onDetailTabChange={ex.setDetailTab}
          />
        ) : null}
      </div>
      {!isModal && p.onExit && ex.graphMobileUx ? (
        <button
          type="button"
          onClick={p.onExit}
          aria-label="대화로 돌아가기"
          data-testid="project-knowledge-graph-mobile-exit"
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 55,
            minHeight: 48,
            borderRadius: 12,
            border: `1px solid ${t.border}`,
            background: t.bgPage,
            fontSize: 14,
            fontWeight: 800,
            color: t.primary,
            boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
            cursor: "pointer",
          }}
        >
          ← 대화로 돌아가기
        </button>
      ) : null}
      <ProjectKnowledgeReplayModal open={replayOpen} projectId={p.projectId} onClose={() => setReplayOpen(false)} />
    </div>
  );
}
