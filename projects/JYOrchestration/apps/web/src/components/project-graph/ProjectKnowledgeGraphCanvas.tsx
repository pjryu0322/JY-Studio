"use client";

import type { CSSProperties, WheelEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  layoutProjectGraphNodes,
  layoutProjectGraphNodesFromRoot,
  type ProjectGraphEdgeUi,
  type ProjectGraphNodeUi,
} from "@/lib/project-graph/projectGraphLayout";
import type { GraphImpactZones } from "@/lib/project-graph/projectGraphExploration";

const NODE_R = 22;

const typeColors: Record<string, string> = {
  Project: "#6366f1",
  Requirement: "#0ea5e9",
  Feature: "#8b5cf6",
  Idea: "#f59e0b",
  default: "#64748b",
};

function nodeColor(nodeType: string): string {
  return typeColors[nodeType] ?? typeColors.default;
}

export function ProjectKnowledgeGraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  highlightNodeIds,
  impactZones,
  onSelectNode,
  onOpenNodeDetail,
  onSelectEdge,
  width,
  height,
  centerOnNodeRequest,
  treeLayoutRootId = null,
}: {
  readonly nodes: readonly ProjectGraphNodeUi[];
  readonly edges: readonly ProjectGraphEdgeUi[];
  readonly selectedNodeId: string | null;
  readonly selectedEdgeId: string | null;
  readonly highlightNodeIds?: ReadonlySet<string>;
  readonly impactZones?: GraphImpactZones | null;
  readonly onSelectNode: (id: string | null) => void;
  readonly onOpenNodeDetail: (id: string) => void;
  readonly onSelectEdge: (id: string | null) => void;
  readonly width: number;
  readonly height: number;
  /** nonce가 바뀔 때마다 해당 노드를 뷰 중앙으로 이동·확대 */
  readonly centerOnNodeRequest?: Readonly<{ readonly nodeId: string; readonly nonce: number }> | null;
  /** 설정 시 선택 노드 기준 조직도형 레이아웃 */
  readonly treeLayoutRootId?: string | null;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { readonly dx: number; readonly dy: number }>>({});
  const panDragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const nodeDragRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const [canvasCursor, setCanvasCursor] = useState<"grab" | "grabbing">("grab");

  const layoutPositions = useMemo(() => {
    const w = Math.max(width, 400);
    const h = Math.max(height, 320);
    const root = String(treeLayoutRootId ?? "").trim();
    if (root) {
      return layoutProjectGraphNodesFromRoot(root, nodes, edges, w, h);
    }
    return layoutProjectGraphNodes(nodes, w, h);
  }, [nodes, edges, width, height, treeLayoutRootId]);

  useEffect(() => {
    setNodeOffsets({});
  }, [treeLayoutRootId, nodes.length]);

  const positions = useMemo(() => {
    const next = new Map(layoutPositions);
    for (const node of nodes) {
      const base = layoutPositions.get(node.id);
      const off = nodeOffsets[node.id];
      if (!base || !off) continue;
      next.set(node.id, { x: base.x + off.dx, y: base.y + off.dy });
    }
    return next;
  }, [layoutPositions, nodeOffsets, nodes]);

  useEffect(() => {
    const nodeId = String(centerOnNodeRequest?.nodeId ?? "").trim();
    if (!nodeId || centerOnNodeRequest?.nonce == null) return;
    const pos = positions.get(nodeId);
    if (!pos) return;
    const targetZoom = 1.35;
    setZoom(targetZoom);
    setPan({
      x: width / 2 - pos.x * targetZoom,
      y: height / 2 - pos.y * targetZoom,
    });
  }, [centerOnNodeRequest, positions, width, height]);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom((z) => Math.min(2.5, Math.max(0.35, z * delta)));
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const nodeDrag = nodeDragRef.current;
      if (nodeDrag) {
        const dx = (e.clientX - nodeDrag.x) / zoom;
        const dy = (e.clientY - nodeDrag.y) / zoom;
        nodeDragRef.current = { ...nodeDrag, x: e.clientX, y: e.clientY };
        setNodeOffsets((prev) => {
          const cur = prev[nodeDrag.nodeId] ?? { dx: 0, dy: 0 };
          return {
            ...prev,
            [nodeDrag.nodeId]: { dx: cur.dx + dx, dy: cur.dy + dy },
          };
        });
        return;
      }
      if (!panDragRef.current.active) return;
      const dx = e.clientX - panDragRef.current.x;
      const dy = e.clientY - panDragRef.current.y;
      panDragRef.current = { active: true, x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    },
    [zoom],
  );

  const endPointerDrag = useCallback(() => {
    panDragRef.current.active = false;
    nodeDragRef.current = null;
    setCanvasCursor("grab");
  }, []);

  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    panDragRef.current = { active: true, x: e.clientX, y: e.clientY };
    setCanvasCursor("grabbing");
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onNodePointerDown = useCallback(
    (nodeId: string, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      onSelectEdge(null);
      if (selectedNodeId !== nodeId) {
        onSelectNode(nodeId);
      }
      nodeDragRef.current = { nodeId, x: e.clientX, y: e.clientY };
      setCanvasCursor("grabbing");
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [onSelectEdge, onSelectNode, selectedNodeId],
  );

  const shell: CSSProperties = {
    flex: 1,
    minHeight: 280,
    borderRadius: 12,
    border: `1px solid ${t.border}`,
    background: "#0f172a",
    overflow: "hidden",
    position: "relative",
    cursor: canvasCursor,
  };

  return (
    <div style={shell}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        onWheel={onWheel}
        onPointerMove={onPointerMove}
        onPointerUp={endPointerDrag}
        onPointerLeave={endPointerDrag}
        role="img"
        aria-label="Project knowledge graph"
      >
        <rect
          width={width}
          height={height}
          fill="#0f172a"
          onPointerDown={onCanvasPointerDown}
          onClick={() => {
            onSelectNode(null);
            onSelectEdge(null);
          }}
          aria-label="그래프 배경"
        />
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {edges.map((edge) => {
            const a = positions.get(edge.fromNodeId);
            const b = positions.get(edge.toNodeId);
            if (!a || !b) return null;
            const selected = selectedEdgeId === edge.id;
            return (
              <g key={edge.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={selected ? "#fbbf24" : "#475569"}
                  strokeWidth={selected ? 3 : 1.5}
                  style={{ pointerEvents: "stroke" }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectEdge(edge.id);
                    onSelectNode(null);
                  }}
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onSelectEdge(edge.id);
                    onSelectNode(null);
                  }}
                />
              </g>
            );
          })}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            const selected = selectedNodeId === node.id;
            const highlighted = highlightNodeIds?.has(node.id) ?? false;
            const impactD1 = impactZones?.depth1.has(node.id) ?? false;
            const impactD2 = impactZones?.depth2.has(node.id) ?? false;
            const fill = nodeColor(node.nodeType);
            const stroke = selected
              ? "#fbbf24"
              : highlighted
                ? "#38bdf8"
                : impactD1
                  ? "#f97316"
                  : impactD2
                    ? "#fb923c"
                    : "#e2e8f0";
            const strokeWidth = selected ? 3 : highlighted || impactD1 ? 2.5 : impactD2 ? 2 : 1;
            const opacity = highlighted || selected || impactD1 || impactD2 ? 1 : 0.92;
            return (
              <g
                key={node.id}
                data-graph-node="1"
                transform={`translate(${pos.x} ${pos.y})`}
                style={{ cursor: selected ? "grab" : "pointer", opacity }}
                onPointerDown={(ev) => onNodePointerDown(node.id, ev)}
                onDoubleClick={(ev) => {
                  ev.stopPropagation();
                  onSelectNode(node.id);
                  onSelectEdge(null);
                  onOpenNodeDetail(node.id);
                }}
              >
                <circle r={NODE_R} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
                <text y={NODE_R + 14} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight={600}>
                  {node.title.length > 18 ? `${node.title.slice(0, 16)}…` : node.title}
                </text>
                <text y={NODE_R + 28} textAnchor="middle" fill="#94a3b8" fontSize={9}>
                  {node.nodeType}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          fontSize: 11,
          color: "#94a3b8",
          background: "rgba(15,23,42,0.85)",
          padding: "4px 8px",
          borderRadius: 6,
        }}
      >
        Zoom {Math.round(zoom * 100)}% · 클릭 선택·드래그 · 더블클릭 상세 · 빈 곳 드래그 이동 · 휠 확대/축소
      </div>
    </div>
  );
}
