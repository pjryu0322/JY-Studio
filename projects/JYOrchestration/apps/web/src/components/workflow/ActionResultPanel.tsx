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

function statusLabelKo(status: CollaborationActionResult["status"]): string {
  switch (status) {
    case "idle":
      return "대기";
    case "running":
      return "실행 중";
    case "success":
      return "성공";
    case "error":
      return "오류";
    default:
      return status;
  }
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
    return <WorkflowEmptyState title="작업 실행 결과" message="아직 실행한 작업이 없습니다." />;
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
        <div style={{ fontSize: 13, fontWeight: 900 }}>마지막 실행</div>
        <WorkflowBadge>{statusLabelKo(result.status)}</WorkflowBadge>
      </div>
      <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>
        <strong>{labelForType(result.actionType)}</strong>
        <span style={{ color: "#6b7280" }}> · {new Date(result.atIso).toLocaleString()}</span>
      </div>
      <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.55 }}>{result.message}</div>
      {result.status === "success" && result.generationSource === "mock_stub" ? (
        <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.45 }}>
          생성 출처: 로컬 목(아직 AI·외부 오케스트레이션과 연결되지 않음).
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
              ? "워크스페이스 갱신(공식 산출물)"
              : "워크스페이스 갱신(보조만)"}
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
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900 }}>원시 페이로드(선택)</summary>
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

