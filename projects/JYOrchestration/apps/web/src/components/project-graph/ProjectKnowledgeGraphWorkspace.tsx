"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { uiTokens as t } from "@/components/ui/tokens";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { ProjectKnowledgeGraphCanvas } from "@/components/project-graph/ProjectKnowledgeGraphCanvas";
import { ProjectKnowledgeGraphActivityPanel } from "@/components/project-graph/ProjectKnowledgeGraphActivityPanel";
import { FixedToast } from "@/components/ui/FixedToast";
import { ProjectGraphContextMenu, type ProjectGraphContextMenuItem } from "@/components/project-graph/ProjectGraphContextMenu";
import { ProjectGraphNodeActionSheet } from "@/components/project-graph/ProjectGraphNodeActionSheet";
import { ProjectKnowledgeGraphNodeBottomSheet } from "@/components/project-graph/ProjectKnowledgeGraphNodeBottomSheet";
import { useProjectGraphContextMenu } from "@/components/project-graph/useProjectGraphContextMenu";
import { useGraphMobileUx } from "@/components/project-graph/useGraphMobileUx";
import { useProjectKnowledgeGraphToast } from "@/components/project-graph/useProjectKnowledgeGraphToast";
import { ProjectGraphNodeDetailPanel } from "@/components/project-graph/ProjectGraphNodeDetailPanel";
import { fetchProjectGraph, type ProjectGraphEdgeDto, type ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import {
  loadProjectGraphActivitySummary,
  type ProjectGraphActivitySummary,
} from "@/lib/project-graph/projectGraphActivityClient";
import { filterGraphNodes } from "@/lib/project-graph/projectGraphLayout";
import {
  applyGraphExplorationQuery,
  buildUndirectedAdjacency,
  collectNeighbors,
  computeImpactZones,
  findGraphNodeIdsForSourceMessageId,
  parseGraphQuestionQuery,
} from "@/lib/project-graph/projectGraphExploration";
import { requirementsWorkspaceMainRowStyle } from "@/components/requirements/requirementsWorkspaceLayoutStyles";
import type { ProjectKnowledgeGraphLaunchContext } from "@/components/project-graph/projectKnowledgeGraphLaunchTypes";

const LIFECYCLE_OPTIONS = ["", "PROJECTED", "APPROVED", "CANDIDATE"] as const;

const QUESTION_HINTS = [
  "왜 생성되었는가?",
  "어떤 대화에서 생성되었는가?",
  "어떤 기능과 연결되는가?",
  "어떤 화면에 영향을 주는가?",
  "어떤 Review가 존재하는가?",
] as const;

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
  const router = useRouter();
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);

  const isModal = variant === "modal";
  const viewMode = clientReady ? String(searchParams?.get("view") ?? "").trim() : "";
  type WorkspacePane = "graph" | "activity";
  const [workspacePane, setWorkspacePane] = useState<WorkspacePane>("graph");

  useEffect(() => {
    if (!clientReady) return;
    if (viewMode === "activity") setWorkspacePane("activity");
  }, [clientReady, viewMode]);

  const activityView = workspacePane === "activity";
  const syncOnEntry =
    clientReady && (isModal || searchParams?.get("sync") === "true");
  const highlightSourceMessageId = clientReady
    ? String(initialSourceMessageId ?? searchParams?.get("sourceMessageId") ?? "").trim() || null
    : null;
  const { effectiveLayout } = useWorkspaceMode();
  const graphMobileUx = useGraphMobileUx();
  const isMobileLayout = clientReady && effectiveLayout === "MOBILE";

  const [nodes, setNodes] = useState<ProjectGraphNodeDto[]>([]);
  const [edges, setEdges] = useState<ProjectGraphEdgeDto[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [treeLayoutRootId, setTreeLayoutRootId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(true);
  const [viewResetNonce, setViewResetNonce] = useState(0);
  const contextMenu = useProjectGraphContextMenu();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [nodeTypeFilter, setNodeTypeFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [edgeTypeFilter, setEdgeTypeFilter] = useState("");
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activitySummary, setActivitySummary] = useState<ProjectGraphActivitySummary | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [centerOnNodeNonce, setCenterOnNodeNonce] = useState(0);
  const { toastMessage, showToast } = useProjectKnowledgeGraphToast();

  const reloadActivity = useCallback(
    async (withSync: boolean) => {
      const pid = projectId.trim();
      if (!pid) return;
      setActivityError(null);
      setActivityLoading(true);
      try {
        const summary = await loadProjectGraphActivitySummary(pid, { sync: withSync });
        setActivitySummary(summary);
      } catch (e) {
        setActivityError(e instanceof Error ? e.message : "생성 현황을 불러오지 못했습니다.");
      } finally {
        setActivityLoading(false);
      }
    },
    [projectId],
  );

  const reload = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    setError(null);
    setLoading(true);
    try {
      const graph = await fetchProjectGraph(pid, { limit: 300 });
      setNodes(graph.nodes);
      setEdges(graph.edges);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!clientReady) return;
    void (async () => {
      const pid = projectId.trim();
      if (!pid) return;
      if (syncOnEntry) {
        await fetch(`/api/projects/${encodeURIComponent(pid)}/graph?sync=true&limit=1`, {
          credentials: "include",
          cache: "no-store",
        });
      }
      await reload();
    })();
  }, [clientReady, projectId, syncOnEntry, reload]);

  useEffect(() => {
    if (!clientReady || !activityView) return;
    void reloadActivity(syncOnEntry);
  }, [clientReady, activityView, projectId, syncOnEntry, reloadActivity]);

  useEffect(() => {
    if (!clientReady) return;
    const focus = String(searchParams?.get("focusNodeId") ?? "").trim();
    const sourceMessageId = String(searchParams?.get("sourceMessageId") ?? "").trim();
    if (nodes.length === 0) return;

    if (focus) {
      setFocusNodeId(focus);
      setSelectedNodeId(focus);
      setExpandedNodeIds(new Set(collectNeighbors(focus, buildUndirectedAdjacency(edges))));
      setCenterOnNodeNonce((n) => n + 1);
      return;
    }
    if (sourceMessageId) {
      const ids = findGraphNodeIdsForSourceMessageId(nodes, sourceMessageId);
      if (ids[0]) {
        setFocusNodeId(ids[0]);
        setSelectedNodeId(ids[0]);
        setExpandedNodeIds(new Set(collectNeighbors(ids[0], buildUndirectedAdjacency(edges))));
        setCenterOnNodeNonce((n) => n + 1);
      }
    }
  }, [clientReady, searchParams, nodes, edges]);

  useEffect(() => {
    if (!onLaunchContextChange) return;
    onLaunchContextChange({
      focusNodeId,
      selectedNodeId,
      activityView,
      sourceMessageId: highlightSourceMessageId,
    });
  }, [onLaunchContextChange, focusNodeId, selectedNodeId, activityView, highlightSourceMessageId]);

  const adjacency = useMemo(() => buildUndirectedAdjacency(edges), [edges]);
  const nodeTypes = useMemo(() => [...new Set(nodes.map((n) => n.nodeType))].sort(), [nodes]);

  const explorationQuery = useMemo(() => parseGraphQuestionQuery(search), [search]);
  const explored = useMemo(() => applyGraphExplorationQuery(nodes, explorationQuery), [nodes, explorationQuery]);

  const filteredNodes = useMemo(() => {
    let list = explored.nodes;
    list = filterGraphNodes(list, { nodeType: nodeTypeFilter || explorationQuery.nodeTypeFilter, lifecycle: lifecycleFilter });
    if (focusNodeId) {
      const visible = new Set<string>([focusNodeId, ...expandedNodeIds]);
      list = list.filter((n) => visible.has(n.id));
    }
    return list;
  }, [explored.nodes, nodeTypeFilter, lifecycleFilter, explorationQuery.nodeTypeFilter, focusNodeId, expandedNodeIds]);

  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => {
      if (!visibleNodeIds.has(e.fromNodeId) || !visibleNodeIds.has(e.toNodeId)) return false;
      if (edgeTypeFilter && e.edgeType !== edgeTypeFilter) return false;
      if (explorationQuery.edgeTypeFilter && e.edgeType !== explorationQuery.edgeTypeFilter) return false;
      return true;
    });
  }, [edges, filteredNodes, edgeTypeFilter, explorationQuery.edgeTypeFilter]);

  const selectedNode =
    filteredNodes.find((n) => n.id === selectedNodeId) ?? nodes.find((n) => n.id === selectedNodeId) ?? null;
  const detailNode =
    filteredNodes.find((n) => n.id === detailNodeId) ?? nodes.find((n) => n.id === detailNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const nodeTitleById = useMemo(() => new Map(nodes.map((n) => [n.id, n.title])), [nodes]);

  const selectionImpact = useMemo(
    () => (selectedNodeId ? computeImpactZones(selectedNodeId, adjacency, 2) : null),
    [selectedNodeId, adjacency],
  );

  const detailImpact = useMemo(
    () => (detailNodeId ? computeImpactZones(detailNodeId, adjacency, 2) : null),
    [detailNodeId, adjacency],
  );

  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
      setSelectedEdgeId(null);
    } else {
      setDetailNodeId(null);
    }
  }, []);

  const handleOpenNodeDetail = useCallback((id: string) => {
    setSelectedNodeId(id);
    setDetailNodeId(id);
    setSelectedEdgeId(null);
  }, []);

  const handleSelectRelatedNodeId = useCallback(
    (id: string) => {
      handleOpenNodeDetail(id);
      setFocusNodeId((prev) => prev ?? id);
    },
    [handleOpenNodeDetail],
  );

  const closeMobileNodeSheet = useCallback(() => {
    setDetailNodeId(null);
  }, []);

  const handleFocusNode = useCallback(
    (targetNodeId?: string | null) => {
      const nid = String(targetNodeId ?? selectedNodeId ?? "").trim();
      if (!nid) {
        showToast("노드를 먼저 선택하세요.");
        return;
      }
      setSelectedNodeId(nid);
      setFocusNodeId(nid);
      setExpandedNodeIds(new Set(collectNeighbors(nid, adjacency)));
      setCenterOnNodeNonce((n) => n + 1);
      showToast("노드 중심 이동 완료");
    },
    [selectedNodeId, adjacency, showToast],
  );

  const handleExpandNeighbors = useCallback(
    (targetNodeId?: string | null) => {
      const nid = String(targetNodeId ?? selectedNodeId ?? "").trim();
      if (!nid) {
        showToast("노드를 먼저 선택하세요.");
        return;
      }
      setSelectedNodeId(nid);
      const neighbors = collectNeighbors(nid, adjacency);
      let added = 0;
      setExpandedNodeIds((prev) => {
        const next = new Set(prev);
        for (const n of neighbors) {
          if (!next.has(n)) added += 1;
          next.add(n);
        }
        next.add(focusNodeId ?? nid);
        return next;
      });
      if (!focusNodeId) setFocusNodeId(nid);
      showToast(added > 0 ? `+${added}개 노드 확장됨` : "인접 노드가 이미 표시 중입니다.");
    },
    [selectedNodeId, adjacency, focusNodeId, showToast],
  );

  const handleCollapseFocus = useCallback(
    (targetNodeId?: string | null) => {
      const nid = String(targetNodeId ?? selectedNodeId ?? "").trim();
      if (!nid) {
        showToast("노드를 먼저 선택하세요.");
        return;
      }
      setSelectedNodeId(nid);
      setFocusNodeId(null);
      setExpandedNodeIds(new Set());
      showToast("확장된 노드 접힘");
    },
    [selectedNodeId, showToast],
  );

  const handleShowAllGraph = useCallback(() => {
    setFocusNodeId(null);
    setExpandedNodeIds(new Set());
    setTreeLayoutRootId(null);
    showToast("전체 그래프 보기");
  }, [showToast]);

  const handleOrgChartLayout = useCallback(
    (targetNodeId?: string | null) => {
      const nid = String(targetNodeId ?? selectedNodeId ?? "").trim();
      if (!nid) {
        showToast("노드를 먼저 선택하세요.");
        return;
      }
      setSelectedNodeId(nid);
      setTreeLayoutRootId(nid);
      setCenterOnNodeNonce((n) => n + 1);
      showToast("선택 노드 기준 조직도 정렬");
    },
    [selectedNodeId, showToast],
  );

  const handleAutoLayout = useCallback(() => {
    setTreeLayoutRootId(null);
    setViewResetNonce((n) => n + 1);
    showToast("자동 정렬 적용");
  }, [showToast]);

  const handleResetZoom = useCallback(() => {
    setViewResetNonce((n) => n + 1);
    showToast("줌 초기화");
  }, [showToast]);

  const handleOpenRelatedConversation = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      const href = node?.explainability?.sourceConversation?.href;
      if (!href) {
        showToast("연결된 대화를 찾을 수 없습니다.");
        return;
      }
      router.push(href);
      showToast("원본 대화로 이동합니다.");
    },
    [nodes, router, showToast],
  );

  const handleShowImpactAnalysis = useCallback(
    (nodeId: string) => {
      handleOpenNodeDetail(nodeId);
      if (!graphMobileUx) setDetailPanelOpen(true);
      showToast("영향 분석을 상세 패널에서 확인하세요.");
    },
    [handleOpenNodeDetail, graphMobileUx, showToast],
  );

  const buildNodeMenuItems = useCallback(
    (nodeId: string): readonly ProjectGraphContextMenuItem[] => {
      const node = nodes.find((n) => n.id === nodeId);
      const hasConversation = Boolean(node?.explainability?.sourceConversation?.href);
      return [
        { id: "focus", label: "Focus", onSelect: () => handleFocusNode(nodeId) },
        { id: "neighbors", label: "이웃 노드 보기", onSelect: () => handleExpandNeighbors(nodeId) },
        { id: "collapse", label: "노드 접기", onSelect: () => handleCollapseFocus(nodeId) },
        {
          id: "conversation",
          label: "관련 대화 보기",
          disabled: !hasConversation,
          onSelect: () => handleOpenRelatedConversation(nodeId),
        },
        { id: "detail", label: "노드 상세 보기", onSelect: () => handleOpenNodeDetail(nodeId) },
        { id: "impact", label: "영향 분석", onSelect: () => handleShowImpactAnalysis(nodeId) },
      ];
    },
    [
      nodes,
      handleFocusNode,
      handleExpandNeighbors,
      handleCollapseFocus,
      handleOpenRelatedConversation,
      handleOpenNodeDetail,
      handleShowImpactAnalysis,
    ],
  );

  const buildMobileNodeMenuItems = useCallback(
    (nodeId: string): readonly ProjectGraphContextMenuItem[] => {
      const node = nodes.find((n) => n.id === nodeId);
      const hasConversation = Boolean(node?.explainability?.sourceConversation?.href);
      return [
        { id: "focus", label: "Focus", onSelect: () => handleFocusNode(nodeId) },
        { id: "neighbors", label: "이웃 노드 보기", onSelect: () => handleExpandNeighbors(nodeId) },
        {
          id: "conversation",
          label: "관련 대화",
          disabled: !hasConversation,
          onSelect: () => handleOpenRelatedConversation(nodeId),
        },
        { id: "detail", label: "상세 보기", onSelect: () => handleOpenNodeDetail(nodeId) },
      ];
    },
    [nodes, handleFocusNode, handleExpandNeighbors, handleOpenRelatedConversation, handleOpenNodeDetail],
  );

  const canvasMenuItems = useMemo((): readonly ProjectGraphContextMenuItem[] => {
    const hasSelection = Boolean(selectedNodeId);
    return [
      { id: "show-all", label: "전체 보기", onSelect: () => handleShowAllGraph() },
      {
        id: "org",
        label: "조직도 정렬",
        disabled: !hasSelection,
        onSelect: () => handleOrgChartLayout(),
      },
      { id: "auto", label: "자동 정렬", onSelect: () => handleAutoLayout() },
      { id: "refresh", label: "새로고침", onSelect: () => void reload() },
      { id: "zoom", label: "줌 초기화", onSelect: () => handleResetZoom() },
    ];
  }, [selectedNodeId, handleShowAllGraph, handleOrgChartLayout, handleAutoLayout, handleResetZoom, reload]);

  const contextMenuNodeId =
    contextMenu.menu.open && contextMenu.menu.kind === "node" ? contextMenu.menu.nodeId : null;
  const nodeContextMenuItems = useMemo(
    () => (contextMenuNodeId ? buildNodeMenuItems(contextMenuNodeId) : []),
    [contextMenuNodeId, buildNodeMenuItems],
  );

  const actionSheetNode = useMemo(() => {
    const id = contextMenu.actionSheetNodeId;
    if (!id) return null;
    return nodes.find((n) => n.id === id) ?? null;
  }, [contextMenu.actionSheetNodeId, nodes]);

  const shell: CSSProperties = {
    ...requirementsWorkspaceMainRowStyle,
    display: "flex",
    flexDirection: graphMobileUx || isMobileLayout ? "column" : "row",
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
    padding: graphMobileUx ? "10px 12px" : "6px 10px",
    minHeight: graphMobileUx ? 44 : undefined,
    minWidth: graphMobileUx ? 44 : undefined,
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.bgPage,
    cursor: "pointer",
  };

  const canvasHeight = graphMobileUx ? 400 : 520;
  const canvasWidth = 960;
  const centerOnNodeRequest =
    selectedNodeId && centerOnNodeNonce > 0
      ? { nodeId: selectedNodeId, nonce: centerOnNodeNonce }
      : null;

  const viewTabStyle = (active: boolean): CSSProperties => ({
    minHeight: 44,
    minWidth: 88,
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${active ? t.primary : t.border}`,
    background: active ? "#eff6ff" : t.bgPage,
    color: active ? t.primary : t.textSecondary,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {toastMessage ? (
        <FixedToast tone="success" aria-live="polite">
          {toastMessage}
        </FixedToast>
      ) : null}
      <div
        role="tablist"
        aria-label="지식 그래프 보기"
        style={{ display: "flex", gap: 8, padding: "0 0 10px", flexShrink: 0 }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={workspacePane === "graph"}
          onClick={() => setWorkspacePane("graph")}
          style={viewTabStyle(workspacePane === "graph")}
        >
          그래프
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={workspacePane === "activity"}
          onClick={() => setWorkspacePane("activity")}
          style={viewTabStyle(workspacePane === "activity")}
        >
          Activity
        </button>
      </div>
      {activityView ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <ProjectKnowledgeGraphActivityPanel
            projectId={projectId}
            summary={activitySummary}
            loading={activityLoading}
            error={activityError}
            highlightSourceMessageId={highlightSourceMessageId}
            showTimeline
            onRefresh={() => {
              void reloadActivity(true);
              void reload();
            }}
          />
        </div>
      ) : (
        <>
          <div style={toolbar}>
            <div
              style={{
                flex: "1 1 100%",
                fontSize: 12,
                fontWeight: 700,
                color: selectedNode ? t.textPrimary : t.textMuted,
              }}
              aria-live="polite"
            >
              {selectedNode ? `현재 선택: ${selectedNode.title}` : "선택된 노드 없음"}
            </div>
        <input
          type="search"
          placeholder="노드·질문 검색 (예: 왜 생성되었는가?)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          list="graph-question-hints"
          style={{ ...inputStyle, flex: "1 1 200px", maxWidth: 360 }}
          aria-label="그래프 질문 검색"
        />
        <datalist id="graph-question-hints">
          {QUESTION_HINTS.map((q) => (
            <option key={q} value={q} />
          ))}
        </datalist>
        <select value={nodeTypeFilter} onChange={(e) => setNodeTypeFilter(e.target.value)} style={inputStyle} aria-label="노드 타입 필터">
          <option value="">모든 타입</option>
          {nodeTypes.map((nt) => (
            <option key={nt} value={nt}>
              {nt}
            </option>
          ))}
        </select>
        <select value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)} style={inputStyle} aria-label="라이프사이클 필터">
          {LIFECYCLE_OPTIONS.map((opt) => (
            <option key={opt || "all"} value={opt}>
              {opt || "모든 상태"}
            </option>
          ))}
        </select>
        {!graphMobileUx ? (
          <button
            type="button"
            onClick={() => setDetailPanelOpen((v) => !v)}
            aria-pressed={detailPanelOpen}
            style={btnStyle}
          >
            {detailPanelOpen ? "상세 숨기기" : "상세 보기"}
          </button>
        ) : null}
        <span style={{ fontSize: 11, color: t.textMuted }}>
          {filteredNodes.length} nodes · {filteredEdges.length} edges
          {explorationQuery.kind === "question" ? " · 질문 모드" : ""}
        </span>
      </div>

      {error ? <p style={{ padding: 12, margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p> : null}
      {loading ? <p style={{ padding: 12, margin: 0, color: t.textMuted, fontSize: 13 }}>그래프 불러오는 중…</p> : null}

      <div style={shell}>
        <div
          style={{
            flex: graphMobileUx ? "7 1 0%" : "6 1 0%",
            minWidth: 0,
            minHeight: graphMobileUx ? 420 : 520,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <ProjectKnowledgeGraphCanvas
            nodes={filteredNodes}
            edges={filteredEdges}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            highlightNodeIds={explored.highlightIds}
            impactZones={selectionImpact}
            onSelectNode={handleSelectNode}
            onOpenNodeDetail={handleOpenNodeDetail}
            onSelectEdge={setSelectedEdgeId}
            width={canvasWidth}
            height={canvasHeight}
            centerOnNodeRequest={centerOnNodeRequest}
            treeLayoutRootId={treeLayoutRootId}
            viewResetNonce={viewResetNonce}
            enableLongPressMenu={graphMobileUx}
            onNodeContextMenu={contextMenu.openNodeMenu}
            onCanvasContextMenu={contextMenu.openCanvasMenu}
            onNodeLongPress={contextMenu.openNodeActionSheet}
            onCanvasLongPress={contextMenu.openCanvasMenu}
          />
          <ProjectGraphContextMenu
            open={contextMenu.menu.open && contextMenu.menu.kind === "node"}
            x={contextMenu.menu.open && contextMenu.menu.kind === "node" ? contextMenu.menu.x : 0}
            y={contextMenu.menu.open && contextMenu.menu.kind === "node" ? contextMenu.menu.y : 0}
            items={nodeContextMenuItems}
            ariaLabel="노드 작업 메뉴"
            onClose={contextMenu.close}
          />
          <ProjectGraphContextMenu
            open={contextMenu.menu.open && contextMenu.menu.kind === "canvas"}
            x={contextMenu.menu.open && contextMenu.menu.kind === "canvas" ? contextMenu.menu.x : 0}
            y={contextMenu.menu.open && contextMenu.menu.kind === "canvas" ? contextMenu.menu.y : 0}
            items={canvasMenuItems}
            ariaLabel="캔버스 작업 메뉴"
            onClose={contextMenu.close}
          />
          {graphMobileUx ? (
            <ProjectGraphNodeActionSheet
              open={Boolean(actionSheetNode)}
              nodeTitle={actionSheetNode?.title ?? "노드"}
              items={actionSheetNode ? buildMobileNodeMenuItems(actionSheetNode.id) : []}
              onClose={contextMenu.close}
            />
          ) : null}
          {graphMobileUx ? (
            <ProjectKnowledgeGraphNodeBottomSheet
              open={Boolean(detailNode)}
              node={detailNode}
              impact={detailImpact}
              onClose={closeMobileNodeSheet}
              onSelectRelatedNodeId={handleSelectRelatedNodeId}
            />
          ) : null}
          {selectedEdge ? (
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${t.border}`, fontSize: 12, color: t.textSecondary }}>
              <strong>선택된 관계:</strong> {selectedEdge.edgeType} · {nodeTitleById.get(selectedEdge.fromNodeId) ?? selectedEdge.fromNodeId} →{" "}
              {nodeTitleById.get(selectedEdge.toNodeId) ?? selectedEdge.toNodeId}
            </div>
          ) : null}
        </div>
        {!graphMobileUx && detailPanelOpen ? (
          <ProjectGraphNodeDetailPanel
            node={detailNode}
            impact={detailImpact}
            onSelectRelatedNodeId={handleSelectRelatedNodeId}
          />
        ) : null}
      </div>
          {!isModal && onExit && graphMobileUx ? (
            <button
              type="button"
              onClick={onExit}
              aria-label="대화로 돌아가기"
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
        </>
      )}
    </div>
  );
}
