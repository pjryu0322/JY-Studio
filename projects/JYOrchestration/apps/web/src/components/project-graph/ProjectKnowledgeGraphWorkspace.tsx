"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { uiTokens as t } from "@/components/ui/tokens";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { ProjectKnowledgeGraphCanvas } from "@/components/project-graph/ProjectKnowledgeGraphCanvas";
import { ProjectKnowledgeGraphActivityPanel } from "@/components/project-graph/ProjectKnowledgeGraphActivityPanel";
import {
  ProjectGraphNodeDetailPanel,
  ProjectGraphRelatedExplorerStrip,
} from "@/components/project-graph/ProjectGraphNodeDetailPanel";
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
}: {
  readonly projectId: string;
  readonly variant?: "page" | "modal";
  readonly initialSourceMessageId?: string | null;
}) {
  const searchParams = useSearchParams();
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);

  const isModal = variant === "modal";
  const viewMode = clientReady && !isModal ? String(searchParams?.get("view") ?? "").trim() : "";
  const activityView = isModal || viewMode === "activity";
  const syncOnEntry =
    clientReady && (isModal || searchParams?.get("sync") === "true");
  const highlightSourceMessageId = clientReady
    ? String(initialSourceMessageId ?? searchParams?.get("sourceMessageId") ?? "").trim() || null
    : null;
  const { effectiveLayout } = useWorkspaceMode();
  const isMobile = clientReady && effectiveLayout === "MOBILE";

  const [nodes, setNodes] = useState<ProjectGraphNodeDto[]>([]);
  const [edges, setEdges] = useState<ProjectGraphEdgeDto[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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
      return;
    }
    if (sourceMessageId) {
      const ids = findGraphNodeIdsForSourceMessageId(nodes, sourceMessageId);
      if (ids[0]) {
        setFocusNodeId(ids[0]);
        setSelectedNodeId(ids[0]);
        setExpandedNodeIds(new Set(collectNeighbors(ids[0], buildUndirectedAdjacency(edges))));
      }
    }
  }, [clientReady, searchParams, nodes, edges]);

  const adjacency = useMemo(() => buildUndirectedAdjacency(edges), [edges]);
  const edgeTypes = useMemo(() => [...new Set(edges.map((e) => e.edgeType))].sort(), [edges]);
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
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const nodeTitleById = useMemo(() => new Map(nodes.map((n) => [n.id, n.title])), [nodes]);

  const impact = useMemo(
    () => (selectedNodeId ? computeImpactZones(selectedNodeId, adjacency, 2) : null),
    [selectedNodeId, adjacency],
  );

  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    if (id) setSelectedEdgeId(null);
  }, []);

  const handleFocusNode = useCallback(() => {
    if (!selectedNodeId) return;
    setFocusNodeId(selectedNodeId);
    setExpandedNodeIds(new Set(collectNeighbors(selectedNodeId, adjacency)));
  }, [selectedNodeId, adjacency]);

  const handleExpandNeighbors = useCallback(() => {
    if (!selectedNodeId) return;
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      for (const n of collectNeighbors(selectedNodeId, adjacency)) next.add(n);
      if (focusNodeId) next.add(focusNodeId);
      return next;
    });
  }, [selectedNodeId, adjacency, focusNodeId]);

  const handleCollapseFocus = useCallback(() => {
    setFocusNodeId(null);
    setExpandedNodeIds(new Set());
  }, []);

  const shell: CSSProperties = {
    ...requirementsWorkspaceMainRowStyle,
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
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
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.bgPage,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {activityView ? (
        <ProjectKnowledgeGraphActivityPanel
          summary={activitySummary}
          loading={activityLoading}
          error={activityError}
          highlightSourceMessageId={highlightSourceMessageId}
          onRefresh={() => {
            void reloadActivity(true);
            void reload();
          }}
        />
      ) : null}
      <div style={toolbar}>
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
        <select value={edgeTypeFilter} onChange={(e) => setEdgeTypeFilter(e.target.value)} style={inputStyle} aria-label="관계 필터">
          <option value="">모든 관계</option>
          {edgeTypes.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleFocusNode} disabled={!selectedNodeId} style={btnStyle}>
          Focus
        </button>
        <button type="button" onClick={handleExpandNeighbors} disabled={!selectedNodeId} style={btnStyle}>
          Neighbor Expand
        </button>
        <button type="button" onClick={handleCollapseFocus} style={btnStyle}>
          Collapse
        </button>
        <button type="button" onClick={() => void reload()} style={btnStyle}>
          새로고침
        </button>
        <span style={{ fontSize: 11, color: t.textMuted }}>
          {filteredNodes.length} nodes · {filteredEdges.length} edges
          {explorationQuery.kind === "question" ? " · 질문 모드" : ""}
        </span>
      </div>

      {error ? <p style={{ padding: 12, margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p> : null}
      {loading ? <p style={{ padding: 12, margin: 0, color: t.textMuted, fontSize: 13 }}>그래프 불러오는 중…</p> : null}

      <div style={shell}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 280 }}>
          <ProjectKnowledgeGraphCanvas
            nodes={filteredNodes}
            edges={filteredEdges}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            highlightNodeIds={explored.highlightIds}
            impactZones={impact}
            onSelectNode={handleSelectNode}
            onSelectEdge={setSelectedEdgeId}
            width={960}
            height={520}
          />
          <ProjectGraphRelatedExplorerStrip
            node={selectedNode}
            onSelectRelatedNodeId={(id) => {
              handleSelectNode(id);
              setFocusNodeId((prev) => prev ?? id);
            }}
          />
          {selectedEdge ? (
            <div style={{ padding: "8px 12px", borderTop: `1px solid ${t.border}`, fontSize: 12, color: t.textSecondary }}>
              <strong>선택된 관계:</strong> {selectedEdge.edgeType} · {nodeTitleById.get(selectedEdge.fromNodeId) ?? selectedEdge.fromNodeId} →{" "}
              {nodeTitleById.get(selectedEdge.toNodeId) ?? selectedEdge.toNodeId}
            </div>
          ) : null}
        </div>
        {!isMobile ? (
          <ProjectGraphNodeDetailPanel
            node={selectedNode}
            impact={impact}
            onSelectRelatedNodeId={(id) => handleSelectNode(id)}
          />
        ) : selectedNode ? (
          <ProjectGraphNodeDetailPanel
            node={selectedNode}
            impact={impact}
            onSelectRelatedNodeId={(id) => handleSelectNode(id)}
          />
        ) : null}
      </div>
    </div>
  );
}
