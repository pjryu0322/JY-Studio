"use client";

import type { RequirementsServiceFlowChecklistDeferralKind } from "@/lib/requirements/requirementsStateJson";
import type { ServiceFlowStageSlotKey } from "@/components/service-flow/serviceFlowStageDerived";
import { serviceFlowPanelCardStyle } from "@/components/service-flow/serviceFlowStageLayout";
import { Button } from "@/components/ui/Button";
import { uiTokens as t } from "@/components/ui/tokens";

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
        background: t.overlayScrim,
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
          borderRadius: t.radiusLg + 4,
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          boxShadow: t.shadowModal,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary }}>남은 결정사항</div>
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {entries.map((row) => (
            <div
              key={row.key}
              style={{
                ...serviceFlowPanelCardStyle,
                borderRadius: t.radiusLg,
                background: t.bgPage,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 900, color: t.textPrimary }}>{row.label}</div>
              {row.deferral === "pending" ? (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: t.textMuted }}>미정의로 진행됨</div>
              ) : row.deferral === "deferred_next" ? (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: t.textMuted }}>다음 단계에서 검토</div>
              ) : (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Button size="sm" variant="secondary" onClick={() => onJumpToResolve(row.key)}>
                    지금 정하기
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onPatchDeferral(row.key, "pending")}>
                    미정의로 진행
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onPatchDeferral(row.key, "deferred_next")}>
                    다음 단계에서 검토
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <Button size="sm" variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
