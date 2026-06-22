"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { ProjectKnowledgeGraphCanvas } from "@/components/project-graph/ProjectKnowledgeGraphCanvas";
import { ProjectGraphNodeDetailPanel } from "@/components/project-graph/ProjectGraphNodeDetailPanel";
import { fetchProjectGraph, type ProjectGraphEdgeDto, type ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import { filterGraphNodes } from "@/lib/project-graph/projectGraphLayout";
import { requirementsWorkspaceMainRowStyle } from "@/components/requirements/requirementsWorkspaceLayoutStyles";

const LIFECYCLE_OPTIONS = ["", "PROJECTED", "APPROVED", "CANDIDATE"] as const;

export function ProjectKnowledgeGraphWorkspace({ projectId }: { readonly projectId: string }) {
  const { effectiveLayout } = useWorkspaceMode();
  const isMobile = effectiveLayout === "MOBILE";

  const [nodes, setNodes] = useState<ProjectGraphNodeDto[]>([]);
  const [edges, setEdges] = useState<ProjectGraphEdgeDto[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [nodeTypeFilter, setNodeTypeFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    void reload();
  }, [reload]);

  const nodeTypes = useMemo(() => [...new Set(nodes.map((n) => n.nodeType))].sort(), [nodes]);

  const filteredNodes = useMemo(
    () => filterGraphNodes(nodes, { search, nodeType: nodeTypeFilter, lifecycle: lifecycleFilter }),
    [nodes, search, nodeTypeFilter, lifecycleFilter],
  );

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleNodeIds.has(e.fromNodeId) && visibleNodeIds.has(e.toNodeId)),
    [edges, visibleNodeIds],
  );

  const selectedNode = filteredNodes.find((n) => n.id === selectedNodeId) ?? nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  const nodeTitleById = useMemo(() => new Map(nodes.map((n) => [n.id, n.title])), [nodes]);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={toolbar}>
        <input
          type="search"
          placeholder="노드 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: "1 1 160px", maxWidth: 280 }}
          aria-label="노드 검색"
        />
        <select
          value={nodeTypeFilter}
          onChange={(e) => setNodeTypeFilter(e.target.value)}
          style={inputStyle}
          aria-label="노드 타입 필터"
        >
          <option value="">모든 타입</option>
          {nodeTypes.map((nt) => (
            <option key={nt} value={nt}>
              {nt}
            </option>
          ))}
        </select>
        <select
          value={lifecycleFilter}
          onChange={(e) => setLifecycleFilter(e.target.value)}
          style={inputStyle}
          aria-label="라이프사이클 필터"
        >
          {LIFECYCLE_OPTIONS.map((opt) => (
            <option key={opt || "all"} value={opt}>
              {opt || "모든 상태"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void reload()}
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.bgPage,
            cursor: "pointer",
          }}
        >
          새로고침
        </button>
        <span style={{ fontSize: 11, color: t.textMuted }}>
          {filteredNodes.length} nodes · {visibleEdges.length} edges
        </span>
      </div>

      {error ? <p style={{ padding: 12, margin: 0, color: "#b91c1c", fontSize: 13 }}>{error}</p> : null}
      {loading ? <p style={{ padding: 12, margin: 0, color: t.textMuted, fontSize: 13 }}>그래프 불러오는 중…</p> : null}

      <div style={shell}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 280 }}>
          <ProjectKnowledgeGraphCanvas
            nodes={filteredNodes}
            edges={visibleEdges}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={setSelectedNodeId}
            onSelectEdge={setSelectedEdgeId}
            width={960}
            height={520}
          />
          {selectedEdge ? (
            <div
              style={{
                padding: "8px 12px",
                borderTop: `1px solid ${t.border}`,
                fontSize: 12,
                color: t.textSecondary,
              }}
            >
              <strong>선택된 관계:</strong> {selectedEdge.edgeType} · {nodeTitleById.get(selectedEdge.fromNodeId) ?? selectedEdge.fromNodeId}{" "}
              → {nodeTitleById.get(selectedEdge.toNodeId) ?? selectedEdge.toNodeId}
            </div>
          ) : null}
        </div>
        {!isMobile ? (
          <ProjectGraphNodeDetailPanel node={selectedNode} edges={edges} nodeTitleById={nodeTitleById} />
        ) : selectedNode ? (
          <ProjectGraphNodeDetailPanel node={selectedNode} edges={edges} nodeTitleById={nodeTitleById} />
        ) : null}
      </div>
    </div>
  );
}
