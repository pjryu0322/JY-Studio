"use client";

import type { CollaborationActionResult } from "@/lib/workflow/collaborationActionContract";
import type { WorkspaceImpactNote } from "@/lib/workflow/collaborationWorkspaceImpact";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";

export type ActionWorkspaceImpact = WorkspaceImpactNote;

function labelForType(t: CollaborationActionResult["actionType"]): string {
  if (t === "GENERATE_MINUTES") return "회의록 작성";
  if (t === "GENERATE_FEATURES") return "Feature 생성";
  if (t === "GENERATE_TASKS") return "Task 초안 생성";
  if (t === "REQUEST_ANALYSIS") return "분석 요청";
  return "아이디어 요청";
}

export function ActionResultPanel({
  result,
  workspaceImpact,
}: {
  result: CollaborationActionResult | null;
  /** Plain-language note about what updated in the workspace (official vs supporting). */
  workspaceImpact?: ActionWorkspaceImpact | null;
}) {
  if (!result) {
    return <WorkflowEmptyState title="Action result" message="No action run yet" />;
  }

  const payloadPreview =
    result.payload == null
      ? null
      : (() => {
          try {
            return JSON.stringify(result.payload, null, 2);
          } catch {
            return String(result.payload);
          }
        })();

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>Last run</div>
        <WorkflowBadge>{result.status.toUpperCase()}</WorkflowBadge>
      </div>
      <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>
        <strong>{labelForType(result.actionType)}</strong>
        <span style={{ color: "#6b7280" }}> · {new Date(result.atIso).toLocaleString()}</span>
      </div>
      <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>{result.message}</div>
      {result.status === "success" && result.generationSource === "mock_stub" ? (
        <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
          Generation source: local stub (not connected to AI or external orchestration yet).
        </div>
      ) : null}
      {result.status === "success" && workspaceImpact ? (
        <div
          style={{
            borderLeft: "3px solid #e5e7eb",
            paddingLeft: 12,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>
            {workspaceImpact.scope === "primary"
              ? "Workspace updated (official output)"
              : "Workspace updated (supporting only)"}
          </div>
          {workspaceImpact.lines.map((line, i) => (
            <div key={i} style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
              {line}
            </div>
          ))}
        </div>
      ) : null}
      {payloadPreview ? (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900 }}>Raw payload (optional)</summary>
          <pre
            style={{
              marginTop: 10,
              border: "1px solid #e5e5e5",
              borderRadius: 10,
              padding: 12,
              whiteSpace: "pre-wrap",
              fontSize: 12,
              lineHeight: 1.5,
              background: "#fafafa",
              color: "#111827",
            }}
          >
            {payloadPreview}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

