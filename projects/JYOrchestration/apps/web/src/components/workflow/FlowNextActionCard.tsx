"use client";

import Link from "next/link";
import { appFlowStepHref, type AppFlowStepDef } from "@/lib/workflow/flow-state";

export function FlowNextActionCard({
  offFlow,
  currentIsRequirements,
  next,
  nextReachable,
  nextBlockReason,
  projectId,
}: {
  readonly offFlow: boolean;
  readonly currentIsRequirements: boolean;
  readonly next: AppFlowStepDef | null;
  readonly nextReachable: boolean;
  readonly nextBlockReason: string | null;
  readonly projectId: string | null;
}) {
  const pid = projectId?.trim() || null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>다음 단계</span>
      {offFlow ? (
        <Link
          href={appFlowStepHref("requirements", pid)}
          style={{
            display: "inline-block",
            padding: "10px 16px",
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          아이디어 구체화에서 시작
        </Link>
      ) : next ? (
        nextReachable ? (
          <Link
            href={appFlowStepHref(next.id, pid)}
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 8,
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            다음: {next.label} (이동)
          </Link>
        ) : (
          <>
            <button
              type="button"
              disabled
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#f1f5f9",
                color: "#64748b",
                fontWeight: 700,
                fontSize: 14,
                cursor: "not-allowed",
              }}
            >
              다음: {next.label} (조건 미충족)
            </button>
            {nextBlockReason ? (
              <span style={{ fontSize: 12, color: "#b45309", maxWidth: 480 }}>{nextBlockReason}</span>
            ) : null}
          </>
        )
      ) : (
        <span style={{ fontSize: 13, color: "#64748b" }}>
          마지막 단계입니다. 필요하면 아이디어 구체화로 돌아가 처음부터 다시 정리할 수 있습니다.
        </span>
      )}
      {!currentIsRequirements && !offFlow ? (
        <Link href={appFlowStepHref("requirements", pid)} style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>
          아이디어 구체화로
        </Link>
      ) : null}
    </div>
  );
}
