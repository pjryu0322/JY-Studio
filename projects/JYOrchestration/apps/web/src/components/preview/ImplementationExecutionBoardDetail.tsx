"use client";

import type { CSSProperties } from "react";
import {
  buildImplementationExecutionBoardRowWipOverlay,
  formatImplementationBoardRoleKo,
  formatImplementationBoardStepStatusKo,
  formatImplementationBoardUserConfirmationKo,
} from "@/lib/prototype/implementationExecutionBoardPanelView";
import type { ImplementationExecutionBoardTaskRowV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { ImplementationStageNextAction } from "@/lib/prototype/implementationStageNextActions";

const cardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  background: "#f8fafc",
};

const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 800, color: "#64748b" };
const valueStyle: CSSProperties = { fontSize: 12, fontWeight: 700, color: "#0f172a", marginTop: 2 };

const btnPrimary: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const btnSecondary: CSSProperties = {
  ...btnPrimary,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
};

function DetailField({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

export function ImplementationExecutionBoardDetail({
  row,
  codeAgentWipExecutionV1,
  nextActions,
  onAction,
  onClose,
}: {
  readonly row: ImplementationExecutionBoardTaskRowV1 | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly nextActions: readonly ImplementationStageNextAction[];
  readonly onAction: (label: string) => void;
  readonly onClose?: () => void;
}) {
  if (!row) return null;

  const overlay = buildImplementationExecutionBoardRowWipOverlay({ row, codeAgentWipExecutionV1 });
  const wip = codeAgentWipExecutionV1;
  const latestCommit = wip?.commits[wip.commits.length - 1];
  const rowActions = nextActions.filter((action) => action.priority !== "tertiary").slice(0, 4);

  return (
    <div style={cardStyle} data-testid="implementation-execution-board-detail">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>
          {row.taskId} · {row.title}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: 40,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontSize: 11,
              fontWeight: 800,
              color: "#64748b",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            닫기
          </button>
        ) : null}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
        }}
      >
        <DetailField label="현재 역할" value={formatImplementationBoardRoleKo(row.currentRole)} />
        <DetailField label="개발" value={formatImplementationBoardStepStatusKo(row.developerStatus)} />
        <DetailField label="검수" value={formatImplementationBoardStepStatusKo(row.reviewerStatus)} />
        <DetailField label="보안" value={formatImplementationBoardStepStatusKo(row.securityStatus)} />
        <DetailField label="SCM" value={formatImplementationBoardStepStatusKo(row.scmStatus)} />
        <DetailField label="사용자 확인" value={formatImplementationBoardUserConfirmationKo(row.userConfirmation)} />
        <DetailField label="재작업" value={String(row.reworkCount)} />
        <DetailField label="상태" value={row.statusLabel} />
      </div>

      {row.dependencies.length ? (
        <div style={{ marginTop: 10 }}>
          <DetailField label="선행 의존성" value={row.dependencies.join(", ")} />
        </div>
      ) : null}

      {wip ? (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <DetailField label="WIP 상태" value={wip.status} />
          {overlay?.branchName ? <DetailField label="브랜치" value={overlay.branchName} /> : null}
          {overlay?.commitSha || overlay?.commitMessage ? (
            <DetailField
              label="커밋"
              value={[overlay?.commitSha, overlay?.commitMessage].filter(Boolean).join(" · ")}
            />
          ) : null}
          {latestCommit?.changedFiles.length ? (
            <DetailField label="변경 파일" value={latestCommit.changedFiles.slice(0, 5).join(", ")} />
          ) : null}
          {latestCommit?.testResults.length ? (
            <DetailField label="테스트 결과" value={latestCommit.testResults.join(" / ")} />
          ) : null}
        </div>
      ) : null}

      {row.failureReason !== "none" ? (
        <div style={{ marginTop: 10 }}>
          <DetailField label="실패 사유" value={row.failureReason} />
        </div>
      ) : null}

      {rowActions.length ? (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {rowActions.map((action) => (
            <button
              key={`${action.actionId}-${action.label}`}
              type="button"
              style={action.priority === "primary" ? btnPrimary : btnSecondary}
              onClick={() => onAction(action.label)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
