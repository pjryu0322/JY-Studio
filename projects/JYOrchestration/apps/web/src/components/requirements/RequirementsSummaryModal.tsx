"use client";

import type { CSSProperties } from "react";
import { RequirementsSummaryPanel } from "@/components/requirements/RequirementsSummaryPanel";

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const panel: CSSProperties = {
  width: "min(560px, 100%)",
  maxHeight: "min(88vh, 720px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  borderRadius: 16,
  background: "#fff",
  boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
  border: "1px solid #e2e8f0",
};

export function RequirementsSummaryModal({
  open,
  onClose,
  goals,
  targetUsers,
  scopeIn,
  scopeOut,
  openIssues,
  success,
  onGoalsChange,
  onTargetUsersChange,
  onScopeInChange,
  onScopeOutChange,
  onOpenIssuesChange,
  onSuccessChange,
  onBlurSave,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly goals: string;
  readonly targetUsers: string;
  readonly scopeIn: string;
  readonly scopeOut: string;
  readonly openIssues: string;
  readonly success: string;
  readonly onGoalsChange: (v: string) => void;
  readonly onTargetUsersChange: (v: string) => void;
  readonly onScopeInChange: (v: string) => void;
  readonly onScopeOutChange: (v: string) => void;
  readonly onOpenIssuesChange: (v: string) => void;
  readonly onSuccessChange: (v: string) => void;
  readonly onBlurSave: () => void;
}) {  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="requirements-summary-modal-title"
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panel}>        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid #e2e8f0",
            background: "linear-gradient(180deg, #f8fafc 0%, #fff 100%)",
          }}
        >
          <h2 id="requirements-summary-modal-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
            아이디어 요약 편집
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid #e2e8f0",
              background: "#fff",
              borderRadius: 10,
              padding: "8px 14px",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: "#334155",
            }}
          >
            닫기
          </button>
        </div>
        <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
          <RequirementsSummaryPanel
            goals={goals}
            targetUsers={targetUsers}
            scopeIn={scopeIn}
            scopeOut={scopeOut}
            openIssues={openIssues}
            success={success}
            onGoalsChange={onGoalsChange}
            onTargetUsersChange={onTargetUsersChange}
            onScopeInChange={onScopeInChange}
            onScopeOutChange={onScopeOutChange}
            onOpenIssuesChange={onOpenIssuesChange}
            onSuccessChange={onSuccessChange}
            onBlurSave={onBlurSave}
          />
        </div>
      </div>
    </div>
  );
}
