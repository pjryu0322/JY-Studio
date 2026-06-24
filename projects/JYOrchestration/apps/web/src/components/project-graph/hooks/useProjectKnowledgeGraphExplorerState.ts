"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { ProjectGraphContextMenuItem } from "@/components/project-graph/ProjectGraphContextMenu";
import { useProjectGraphContextMenu } from "@/components/project-graph/useProjectGraphContextMenu";
import { useGraphMobileUx } from "@/components/project-graph/useGraphMobileUx";
import { useProjectKnowledgeGraphToast } from "@/components/project-graph/useProjectKnowledgeGraphToast";
import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import { filterGraphNodes } from "@/lib/project-graph/projectGraphLayout";
import {
  applyGraphExplorationQuery,
  buildUndirectedAdjacency,
  collectNeighbors,
  computeImpactZones,
  findGraphNodeIdsForSourceMessageId,
  parseGraphQuestionQuery,
} from "@/lib/project-graph/projectGraphExploration";

export function useProjectKnowledgeGraphExplorerState(input: {
  readonly nodes: readonly ProjectGraphNodeDto[];
  readonly edges: readonly ProjectGraphEdgeDto[];
  readonly clientReady: boolean;
  readonly searchParams: ReadonlyURLSearchParams | null;
  readonly reloadGraph: () => Promise<void>;
}) {
  const router = useRouter();
  const graphMobileUx = useGraphMobileUx();
  const contextMenu = useProjectGraphContextMenu();
  const { toastMessage, showToast } = useProjectKnowledgeGraphToast();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [treeLayoutRootId, setTreeLayoutRootId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(true);
  const [viewResetNonce, setViewResetNonce] = useState(0);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [nodeTypeFilter, setNodeTypeFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [edgeTypeFilter, setEdgeTypeFilter] = useState("");
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set());
  const [centerOnNodeNonce, setCenterOnNodeNonce] = useState(0);

  useEffect(() => {
    if (!input.clientReady) return;
    const focus = String(input.searchParams?.get("focusNodeId") ?? "").trim();
    const sourceMessageId = String(input.searchParams?.get("sourceMessageId") ?? "").trim();
    if (input.nodes.length === 0) return;

    if (focus) {
      setFocusNodeId(focus);
      setSelectedNodeId(focus);
      setExpandedNodeIds(new Set(collectNeighbors(focus, buildUndirectedAdjacency(input.edges))));
      setCenterOnNodeNonce((n) => n + 1);
      return;
    }
    if (sourceMessageId) {
      const ids = findGraphNodeIdsForSourceMessageId(input.nodes, sourceMessageId);
      if (ids[0]) {
        setFocusNodeId(ids[0]);
        setSelectedNodeId(ids[0]);
        setExpandedNodeIds(new Set(collectNeighbors(ids[0], buildUndirectedAdjacency(input.edges))));
        setCenterOnNodeNonce((n) => n + 1);
      }
    }
  }, [input.clientReady, input.searchParams, input.nodes, input.edges]);

  const adjacency = useMemo(() => buildUndirectedAdjacency(input.edges), [input.edges]);
  const nodeTypes = useMemo(() => [...new Set(input.nodes.map((n) => n.nodeType))].sort(), [input.nodes]);

  const explorationQuery = useMemo(() => parseGraphQuestionQuery(search), [search]);
  const explored = useMemo(
    () => applyGraphExplorationQuery(input.nodes, explorationQuery),
    [input.nodes, explorationQuery],
  );

  const filteredNodes = useMemo(() => {
    let list = explored.nodes;
    list = filterGraphNodes(list, {
      nodeType: nodeTypeFilter || explorationQuery.nodeTypeFilter,
      lifecycle: lifecycleFilter,
    });
    if (focusNodeId) {
      const visible = new Set<string>([focusNodeId, ...expandedNodeIds]);
      list = list.filter((n) => visible.has(n.id));
    }
    return list;
  }, [
    explored.nodes,
    nodeTypeFilter,
    lifecycleFilter,
    explorationQuery.nodeTypeFilter,
    focusNodeId,
    expandedNodeIds,
  ]);

  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return input.edges.filter((e) => {
      if (!visibleNodeIds.has(e.fromNodeId) || !visibleNodeIds.has(e.toNodeId)) return false;
      if (edgeTypeFilter && e.edgeType !== edgeTypeFilter) return false;
      if (explorationQuery.edgeTypeFilter && e.edgeType !== explorationQuery.edgeTypeFilter) return false;
      return true;
    });
  }, [input.edges, filteredNodes, edgeTypeFilter, explorationQuery.edgeTypeFilter]);

  const selectedNode =
    filteredNodes.find((n) => n.id === selectedNodeId) ??
    input.nodes.find((n) => n.id === selectedNodeId) ??
    null;
  const detailNode =
    filteredNodes.find((n) => n.id === detailNodeId) ??
    input.nodes.find((n) => n.id === detailNodeId) ??
    null;
  const selectedEdge = input.edges.find((e) => e.id === selectedEdgeId) ?? null;
  const nodeTitleById = useMemo(() => new Map(input.nodes.map((n) => [n.id, n.title])), [input.nodes]);

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
      const node = input.nodes.find((n) => n.id === nodeId);
      const href = node?.explainability?.sourceConversation?.href;
      if (!href) {
        showToast("연결된 대화를 찾을 수 없습니다.");
        return;
      }
      router.push(href);
      showToast("원본 대화로 이동합니다.");
    },
    [input.nodes, router, showToast],
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
      const node = input.nodes.find((n) => n.id === nodeId);
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
      input.nodes,
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
      const node = input.nodes.find((n) => n.id === nodeId);
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
    [input.nodes, handleFocusNode, handleExpandNeighbors, handleOpenRelatedConversation, handleOpenNodeDetail],
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
      { id: "refresh", label: "새로고침", onSelect: () => void input.reloadGraph() },
      { id: "zoom", label: "줌 초기화", onSelect: () => handleResetZoom() },
    ];
  }, [
    selectedNodeId,
    handleShowAllGraph,
    handleOrgChartLayout,
    handleAutoLayout,
    handleResetZoom,
    input.reloadGraph,
  ]);

  const contextMenuNodeId =
    contextMenu.menu.open && contextMenu.menu.kind === "node" ? contextMenu.menu.nodeId : null;
  const nodeContextMenuItems = useMemo(
    () => (contextMenuNodeId ? buildNodeMenuItems(contextMenuNodeId) : []),
    [contextMenuNodeId, buildNodeMenuItems],
  );

  const actionSheetNode = useMemo(() => {
    const id = contextMenu.actionSheetNodeId;
    if (!id) return null;
    return input.nodes.find((n) => n.id === id) ?? null;
  }, [contextMenu.actionSheetNodeId, input.nodes]);

  const centerOnNodeRequest =
    selectedNodeId && centerOnNodeNonce > 0
      ? { nodeId: selectedNodeId, nonce: centerOnNodeNonce }
      : null;

  return {
    graphMobileUx,
    toastMessage,
    contextMenu,
    selectedNodeId,
    detailNodeId,
    focusNodeId,
    selectedEdgeId,
    selectedNode,
    detailNode,
    selectedEdge,
    nodeTitleById,
    selectionImpact,
    detailImpact,
    search,
    setSearch,
    nodeTypeFilter,
    setNodeTypeFilter,
    lifecycleFilter,
    setLifecycleFilter,
    edgeTypeFilter,
    setEdgeTypeFilter,
    nodeTypes,
    filteredNodes,
    filteredEdges,
    explored,
    explorationQuery,
    treeLayoutRootId,
    viewResetNonce,
    centerOnNodeRequest,
    detailPanelOpen,
    setDetailPanelOpen,
    handleSelectNode,
    handleOpenNodeDetail,
    handleSelectRelatedNodeId,
    closeMobileNodeSheet,
    nodeContextMenuItems,
    canvasMenuItems,
    buildMobileNodeMenuItems,
    actionSheetNode,
    setSelectedEdgeId,
  };
}

export type ProjectKnowledgeGraphExplorerState = ReturnType<typeof useProjectKnowledgeGraphExplorerState>;