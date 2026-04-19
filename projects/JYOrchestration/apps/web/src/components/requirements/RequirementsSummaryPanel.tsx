"use client";

import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

const panelCard = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "10px 12px",
  marginBottom: 10,
} as const;

export function RequirementsSummaryPanel({
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
}) {
  const showScreenLabels = useShowScreenLabels();
  const ta = {
    width: "100%",
    boxSizing: "border-box" as const,
    border: "none",
    fontSize: 13,
    resize: "vertical" as const,
    fontFamily: "inherit",
    background: "transparent",
  };

  return (
    <aside
      data-testid="requirements-summary-panel"
      style={{
        flex: "1 1 30%",
        minWidth: 240,
        display: "flex",
        flexDirection: "column",
        background: "#f9fafb",
      }}
      aria-label="아이디어 요약 패널"
    >
      <ScreenLabel label="요구사항-AI정리패널" visible={showScreenLabels} />
      <div style={{ padding: 12, overflowY: "auto", flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#52525b", marginBottom: 10 }}>요약 메모</div>
        <div style={panelCard}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#71717a", marginBottom: 6 }}>프로젝트 목표</div>
          <textarea value={goals} onChange={(e) => onGoalsChange(e.target.value)} onBlur={onBlurSave} rows={4} style={ta} />
        </div>
        <div style={panelCard}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#71717a", marginBottom: 6 }}>대상 사용자</div>
          <textarea
            data-testid="requirements-target-users"
            value={targetUsers}
            onChange={(e) => onTargetUsersChange(e.target.value)}
            onBlur={onBlurSave}
            rows={3}
            style={ta}
          />
        </div>
        <div style={panelCard}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#71717a", marginBottom: 6 }}>핵심 기능</div>
          <textarea data-testid="requirements-scope-in" value={scopeIn} onChange={(e) => onScopeInChange(e.target.value)} onBlur={onBlurSave} rows={3} style={ta} />
        </div>
        <div style={panelCard}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#71717a", marginBottom: 6 }}>제외 범위</div>
          <textarea data-testid="requirements-scope-out" value={scopeOut} onChange={(e) => onScopeOutChange(e.target.value)} onBlur={onBlurSave} rows={3} style={ta} />
        </div>
        <div style={panelCard}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#71717a", marginBottom: 6 }}>미결정 이슈</div>
          <textarea value={openIssues} onChange={(e) => onOpenIssuesChange(e.target.value)} onBlur={onBlurSave} rows={2} style={ta} />
        </div>
        <div style={panelCard}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#71717a", marginBottom: 6 }}>성공 기준</div>
          <textarea
            data-testid="requirements-success-criteria"
            value={success}
            onChange={(e) => onSuccessChange(e.target.value)}
            onBlur={onBlurSave}
            rows={2}
            style={ta}
          />
        </div>
      </div>
    </aside>
  );
}
