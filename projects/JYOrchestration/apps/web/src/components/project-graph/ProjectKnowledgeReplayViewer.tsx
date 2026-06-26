"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { ProjectKnowledgeGraphCanvas } from "@/components/project-graph/ProjectKnowledgeGraphCanvas";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import {
  createReplayGraphFrame,
  REPLAY_GRAPH_TRANSITION_MS,
  type ReplayGraphFrame,
} from "@/lib/project-graph/projectKnowledgeReplayViewerTransition";
import type { ProjectGraphEdgeDto, ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import { uiTokens as t } from "@/components/ui/tokens";

const loadingBadgeStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 4,
  padding: "6px 10px",
  borderRadius: 8,
  background: "rgba(15, 23, 42, 0.82)",
  color: "#e2e8f0",
  fontSize: 12,
  fontWeight: 700,
  pointerEvents: "none",
};

const errorBadgeStyle: CSSProperties = {
  position: "absolute",
  left: 12,
  right: 12,
  top: 12,
  zIndex: 5,
  margin: 0,
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(254, 226, 226, 0.95)",
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 700,
};

export function ProjectKnowledgeReplayViewer(p: {
  readonly nodes: readonly ProjectGraphNodeDto[];
  readonly edges: readonly ProjectGraphEdgeDto[];
  readonly frameKey?: string;
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly graphMobileUx?: boolean;
}) {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const transitionTokenRef = useRef(0);

  const [currentFrame, setCurrentFrame] = useState<ReplayGraphFrame>(() =>
    createReplayGraphFrame({ frameKey: p.frameKey, nodes: p.nodes, edges: p.edges }),
  );
  const [nextFrame, setNextFrame] = useState<ReplayGraphFrame | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const incomingKey = createReplayGraphFrame({
    frameKey: p.frameKey,
    nodes: p.nodes,
    edges: p.edges,
  }).frameKey;

  useEffect(() => {
    if (incomingKey === currentFrame.frameKey) return;

    const next = createReplayGraphFrame({
      frameKey: p.frameKey,
      nodes: p.nodes,
      edges: p.edges,
    });

    if (prefersReducedMotion) {
      setCurrentFrame(next);
      setNextFrame(null);
      setTransitioning(false);
      return;
    }

    const token = ++transitionTokenRef.current;
    setNextFrame(next);
    setTransitioning(true);

    const timer = window.setTimeout(() => {
      if (transitionTokenRef.current !== token) return;
      setCurrentFrame(next);
      setNextFrame(null);
      setTransitioning(false);
    }, REPLAY_GRAPH_TRANSITION_MS);

    return () => window.clearTimeout(timer);
  }, [incomingKey, p.frameKey, p.nodes, p.edges, prefersReducedMotion, currentFrame.frameKey]);

  const shell: CSSProperties = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    overflow: "hidden",
    background: t.bgPage,
  };

  const height = p.graphMobileUx ? 320 : 480;

  const graphStage: CSSProperties = {
    position: "relative",
    flex: 1,
    minHeight: height,
    height,
    background: "#0f172a",
    overflow: "hidden",
  };

  const baseLayer: CSSProperties = {
    position: "absolute",
    inset: 0,
    transition: prefersReducedMotion ? undefined : `opacity ${REPLAY_GRAPH_TRANSITION_MS}ms ease`,
  };

  const currentLayerStyle: CSSProperties = {
    ...baseLayer,
    opacity: transitioning ? 0 : 1,
  };

  const nextLayerStyle: CSSProperties = {
    ...baseLayer,
    opacity: transitioning ? 1 : 0,
  };

  const canvasProps = {
    selectedNodeId: null as string | null,
    selectedEdgeId: null as string | null,
    highlightNodeIds: new Set<string>(),
    impactZones: null,
    onSelectNode: () => {},
    onOpenNodeDetail: () => {},
    onSelectEdge: () => {},
    width: 960,
    height,
    centerOnNodeRequest: null,
    treeLayoutRootId: null,
    viewResetNonce: 0,
  };

  return (
    <div data-testid="knowledge-replay-viewer" style={shell}>
      <div data-testid="knowledge-replay-graph-stage" style={graphStage}>
        <div data-testid="knowledge-replay-frame-current" style={currentLayerStyle}>
          <ProjectKnowledgeGraphCanvas nodes={currentFrame.nodes} edges={currentFrame.edges} {...canvasProps} />
        </div>
        {nextFrame ? (
          <div data-testid="knowledge-replay-frame-next" style={nextLayerStyle}>
            <ProjectKnowledgeGraphCanvas nodes={nextFrame.nodes} edges={nextFrame.edges} {...canvasProps} />
          </div>
        ) : null}
        {p.error ? <p style={errorBadgeStyle}>{p.error}</p> : null}
        {p.loading ? (
          <div data-testid="knowledge-replay-loading-overlay" style={loadingBadgeStyle}>
            다음 변화 준비 중…
          </div>
        ) : null}
      </div>
    </div>
  );
}
