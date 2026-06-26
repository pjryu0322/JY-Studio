"use client";

import { useEffect } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  ProjectGraphNodeDetailBody,
  type ProjectGraphNodeDetailTab,
} from "@/components/project-graph/ProjectGraphNodeDetailPanel";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import type { GraphImpactZones } from "@/lib/project-graph/projectGraphExploration";

export function ProjectKnowledgeGraphNodeBottomSheet(p: {
  readonly open: boolean;
  readonly projectId: string;
  readonly node: ProjectGraphNodeDto | null;
  readonly impact: GraphImpactZones | null;
  readonly detailTab: ProjectGraphNodeDetailTab;
  readonly onDetailTabChange: (tab: ProjectGraphNodeDetailTab) => void;
  readonly onClose: () => void;
  readonly onSelectRelatedNodeId: (nodeId: string) => void;
  readonly agentViewReason?: string;
}) {
  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        p.onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.open, p.onClose]);

  if (!p.open || !p.node) return null;

  return (
    <>
      <button
        type="button"
        aria-label="노드 상세 닫기"
        onClick={p.onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 18,
          border: 0,
          padding: 0,
          margin: 0,
          background: "rgba(15, 23, 42, 0.25)",
          cursor: "pointer",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${p.node.title} 노드 상세`}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 19,
          maxHeight: "38%",
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          border: `1px solid ${t.border}`,
          borderBottom: "none",
          background: t.bgCard,
          boxShadow: "0 -12px 40px rgba(15, 23, 42, 0.18)",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "10px 16px 8px",
            borderBottom: `1px solid ${t.border}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              background: t.border,
              margin: "0 auto",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: 8,
            }}
          />
          <div style={{ flex: 1, minWidth: 0, paddingTop: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary, overflow: "hidden", textOverflow: "ellipsis" }}>
              {p.node.title}
            </div>
            <div style={{ fontSize: 11, color: t.textMuted }}>{p.node.nodeType}</div>
          </div>
          <button
            type="button"
            onClick={p.onClose}
            aria-label="닫기"
            style={{
              minWidth: 44,
              minHeight: 44,
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              background: t.bgPage,
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px 20px" }}>
          <ProjectGraphNodeDetailBody
            projectId={p.projectId}
            node={p.node}
            impact={p.impact}
            onSelectRelatedNodeId={p.onSelectRelatedNodeId}
            compact
            detailTab={p.detailTab}
            onDetailTabChange={p.onDetailTabChange}
            agentViewReason={p.agentViewReason}
          />
        </div>
      </div>
    </>
  );
}
