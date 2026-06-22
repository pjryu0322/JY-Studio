"use client";

import type { CSSProperties, WheelEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  layoutProjectGraphNodes,
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
  onSelectEdge,
  width,
  height,
}: {
  readonly nodes: readonly ProjectGraphNodeUi[];
  readonly edges: readonly ProjectGraphEdgeUi[];
  readonly selectedNodeId: string | null;
  readonly selectedEdgeId: string | null;
  readonly highlightNodeIds?: ReadonlySet<string>;
  readonly impactZones?: GraphImpactZones | null;
  readonly onSelectNode: (id: string | null) => void;
  readonly onSelectEdge: (id: string | null) => void;
  readonly width: number;
  readonly height: number;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });

  const positions = useMemo(
    () => layoutProjectGraphNodes(nodes, Math.max(width, 400), Math.max(height, 320)),
    [nodes, width, height],
  );

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom((z) => Math.min(2.5, Math.max(0.35, z * delta)));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const shell: CSSProperties = {
    flex: 1,
    minHeight: 280,
    borderRadius: 12,
    border: `1px solid ${t.border}`,
    background: "#0f172a",
    overflow: "hidden",
    position: "relative",
    cursor: dragRef.current.active ? "grabbing" : "grab",
  };

  return (
    <div style={shell}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="img"
        aria-label="Project knowledge graph"
      >
        <rect width={width} height={height} fill="#0f172a" onClick={() => { onSelectNode(null); onSelectEdge(null); }} />
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
                transform={`translate(${pos.x} ${pos.y})`}
                style={{ cursor: "pointer", opacity }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectNode(node.id);
                  onSelectEdge(null);
                }}
              >
                <circle
                  r={NODE_R}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                />
                <text
                  y={NODE_R + 14}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize={11}
                  fontWeight={600}
                >
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
        Zoom {Math.round(zoom * 100)}% · 드래그로 이동 · 휠로 확대/축소
      </div>
    </div>
  );
}
