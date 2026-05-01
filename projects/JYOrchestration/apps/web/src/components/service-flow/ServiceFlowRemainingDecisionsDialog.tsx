"use client";

import type { RequirementsServiceFlowChecklistDeferralKind } from "@/lib/requirements/requirementsStateJson";
import type { ServiceFlowStageSlotKey } from "@/components/service-flow/serviceFlowStageDerived";
import { serviceFlowStageBtnStyle } from "@/components/service-flow/serviceFlowStageUi";

export function ServiceFlowRemainingDecisionsDialog({
  open,
  onClose,
  entries,
  onJumpToResolve,
  onPatchDeferral,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly entries: ReadonlyArray<{
    key: ServiceFlowStageSlotKey;
    label: string;
    deferral?: RequirementsServiceFlowChecklistDeferralKind;
  }>;
  readonly onJumpToResolve: (key: ServiceFlowStageSlotKey) => void;
  readonly onPatchDeferral: (key: ServiceFlowStageSlotKey, kind: RequirementsServiceFlowChecklistDeferralKind | null) => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="남은 결정사항"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 45,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          maxHeight: "min(80vh, 640px)",
          overflowY: "auto",
          borderRadius: 16,
          background: "#fff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
          padding: 16,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>남은 결정사항</div>
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {entries.map((row) => (
            <div key={row.key} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{row.label}</div>
              {row.deferral === "pending" ? (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#64748b" }}>미정의로 진행됨</div>
              ) : row.deferral === "deferred_next" ? (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#64748b" }}>다음 단계에서 검토</div>
              ) : (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" onClick={() => onJumpToResolve(row.key)} style={{ ...serviceFlowStageBtnStyle }}>
                    지금 정하기
                  </button>
                  <button type="button" onClick={() => onPatchDeferral(row.key, "pending")} style={{ ...serviceFlowStageBtnStyle }}>
                    미정의로 진행
                  </button>
                  <button type="button" onClick={() => onPatchDeferral(row.key, "deferred_next")} style={{ ...serviceFlowStageBtnStyle }}>
                    다음 단계에서 검토
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{ ...serviceFlowStageBtnStyle }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
