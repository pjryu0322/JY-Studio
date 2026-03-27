"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { priorityToPLabel } from "@/lib/project-spec/workflowDraftSynthesis";

export type TaskDraftWorkflowNodeData = {
  title: string;
  priority: string;
  /** 캔버스에는 텍스트 없이 시각만 */
  visualState: "blocked" | "ready" | "invalid" | "confirmed";
};

const P_BADGE: Record<"P0" | "P1" | "P2" | "P3", { bg: string; fg: string }> = {
  P0: { bg: "#fee2e2", fg: "#991b1b" },
  P1: { bg: "#ffedd5", fg: "#9a3412" },
  P2: { bg: "#e0f2fe", fg: "#0369a1" },
  P3: { bg: "#f1f5f9", fg: "#475569" },
};

export const TaskDraftWorkflowNode = memo(function TaskDraftWorkflowNode({
  data,
  selected,
}: NodeProps & { data: TaskDraftWorkflowNodeData }) {
  const pl = priorityToPLabel(data.priority);
  const badge = P_BADGE[pl];
  const opacity =
    data.visualState === "blocked" ? 0.5 : data.visualState === "invalid" ? 0.55 : 1;
  const border =
    selected
      ? "2px solid #7c3aed"
      : data.visualState === "invalid"
        ? "1px solid #f87171"
        : "1px solid #cbd5e1";

  return (
    <div
      style={{
        width: 280,
        borderRadius: 12,
        border,
        background: "#fff",
        boxShadow: selected ? "0 2px 12px rgba(124,58,237,0.22)" : "0 1px 3px rgba(15,23,42,0.06)",
        overflow: "hidden",
        opacity,
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1.35, paddingRight: 28 }}>
          {data.title}
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 900,
              padding: "2px 7px",
              borderRadius: 999,
              background: badge.bg,
              color: badge.fg,
              border: "1px solid rgba(15,23,42,0.06)",
            }}
          >
            {pl}
          </span>
        </div>
      </div>
      {data.visualState === "confirmed" ? (
        <span
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            fontSize: 14,
            lineHeight: 1,
            color: "#15803d",
          }}
          aria-hidden
        >
          ✓
        </span>
      ) : data.visualState === "invalid" ? (
        <span
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            fontSize: 13,
            lineHeight: 1,
            color: "#dc2626",
          }}
          aria-hidden
        >
          ⚠
        </span>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
