"use client";

import type { CollaborationActionResult } from "@/lib/workflow/collaborationActionContract";
import { WorkflowBadge } from "@/components/workflow/primitives/WorkflowBadge";
import { WorkflowEmptyState } from "@/components/workflow/primitives/WorkflowEmptyState";

function labelForType(t: CollaborationActionResult["actionType"]): string {
  if (t === "GENERATE_MINUTES") return "회의록 작성";
  if (t === "REQUEST_ANALYSIS") return "분석 요청";
  return "아이디어 요청";
}

export function ActionResultPanel({ result }: { result: CollaborationActionResult | null }) {
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
        <div style={{ fontSize: 13, fontWeight: 900 }}>Latest action</div>
        <WorkflowBadge>{result.status.toUpperCase()}</WorkflowBadge>
      </div>
      <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>
        <strong>{labelForType(result.actionType)}</strong>
        <span style={{ color: "#6b7280" }}> · {new Date(result.atIso).toLocaleString()}</span>
      </div>
      <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>{result.message}</div>
      {payloadPreview ? (
        <details>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900 }}>Payload preview</summary>
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

