"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { APP_FLOW_STEPS, appFlowStepHref, type AppFlowStepId } from "@/lib/workflow/flow-state";
import type { AppFlowGateSnapshot } from "@/lib/workflow/flow-gates";
import { gateReasonForStep, stripStepReachableForUi } from "@/components/workflow/flowStripHelpers";


export function FlowProgressStrip({
  current,
  gates,
  loading,
  projectId,
}: {
  readonly current: AppFlowStepId | null;
  readonly gates: AppFlowGateSnapshot;
  readonly loading: boolean;
  readonly projectId: string | null;
}) {  const stripStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    fontSize: 13,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>      <nav aria-label="전체 워크플로 단계" style={stripStyle}>
        {APP_FLOW_STEPS.map((s, i) => {
          const active = current === s.id;
          const reachable = stripStepReachableForUi(s.id, current, gates);
          const reason = gateReasonForStep(s.id, gates);
          const labelStyle: CSSProperties = {
            fontWeight: active ? 800 : 600,
            color: active ? "#1d4ed8" : reachable ? "#334155" : "#94a3b8",
            whiteSpace: "nowrap",
          };
          const sep = i > 0 ? <span style={{ color: "#cbd5e1" }}>→</span> : null;
          return (
            <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {sep}
              <span
                className="relative"
                style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}
              >
                null
                {reachable ? (
                  <Link href={appFlowStepHref(s.id, projectId?.trim() || null)} style={{ ...labelStyle, textDecoration: "none" }}>
                    {s.label}
                  </Link>
                ) : (
                  <span title={reason ?? undefined} style={{ ...labelStyle, cursor: "not-allowed" }}>
                    {s.label}
                  </span>
                )}
              </span>
            </span>
          );
        })}
        {loading ? <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b" }}>상태 불러오는 중…</span> : null}
      </nav>
    </div>
  );
}
