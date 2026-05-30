"use client";

import type { CSSProperties } from "react";
import {
  buildImplementationExecutionBoardRowWipOverlay,
  buildTaskRowCardView,
  formatImplementationBoardRoleKo,
  formatImplementationBoardStepStatusKo,
  formatImplementationBoardUserConfirmationKo,
  type ImplementationExecutionBoardRowWipOverlay,
} from "@/lib/prototype/implementationExecutionBoardPanelView";
import type {
  ImplementationExecutionBoardIntegratedRowV1,
  ImplementationExecutionBoardTaskRowV1,
  ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { CodeAgentExecutionProgressView } from "@/lib/prototype/codeAgentExecutionProgressView";
import {
  buildTaskRowCursorProgressView,
  type TaskRowCursorProgressView,
} from "@/lib/prototype/codeAgentExecutionProgressView";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import boardStyles from "@/components/preview/implementationExecutionBoardPanel.module.css";

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 11,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "1px solid #e2e8f0",
  color: "#64748b",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid #f1f5f9",
  color: "#0f172a",
  verticalAlign: "top",
};

function statusTone(status: string): CSSProperties {
  if (status === "진행") return { color: "#2563eb", fontWeight: 800 };
  if (status === "완료") return { color: "#16a34a", fontWeight: 800 };
  if (status === "실패") return { color: "#dc2626", fontWeight: 800 };
  if (status === "차단") return { color: "#ea580c", fontWeight: 800 };
  return { color: "#475569", fontWeight: 700 };
}

function WipHint({ overlay }: { readonly overlay: ImplementationExecutionBoardRowWipOverlay | null }) {
  if (!overlay?.branchName && !overlay?.commitMessage) return null;
  return (
    <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, lineHeight: 1.35 }}>
      {overlay.branchName ? <div>{overlay.branchName}</div> : null}
      {overlay.commitMessage ? <div>{overlay.commitMessage}</div> : null}
    </div>
  );
}

function TaskRowCursorProgressBadge({ progress }: { readonly progress: TaskRowCursorProgressView }) {
  const toneClass =
    progress.tone === "polling"
      ? boardStyles.taskRowProgressPolling
      : progress.tone === "verifying"
        ? boardStyles.taskRowProgressVerifying
        : progress.tone === "done"
          ? boardStyles.taskRowProgressDone
          : progress.tone === "failed"
            ? boardStyles.taskRowProgressFailed
            : boardStyles.taskRowProgressIdle;

  return (
    <div
      className={`${boardStyles.taskRowProgressLine} ${toneClass}`}
      data-testid="implementation-task-row-cursor-progress"
      data-polling={progress.isPolling ? "true" : "false"}
    >
      {progress.isPolling ? <span className={boardStyles.taskRowProgressSpinner} aria-hidden /> : null}
      <span>{progress.text}</span>
    </div>
  );
}

export function ImplementationExecutionBoardCardList({
  board,
  selectedTaskId,
  codeAgentWipExecutionV1,
  taskCursorExecutionV1,
  taskCursorExecutionHistoryV1,
  codeAgentProgress,
  onSelectTask,
}: {
  readonly board: ImplementationExecutionBoardV1;
  readonly selectedTaskId: string | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistoryV1?: readonly TaskCursorExecutionV1[] | null;
  readonly codeAgentProgress?: CodeAgentExecutionProgressView | null;
  readonly onSelectTask: (taskId: string) => void;
}) {
  return (
    <>
      {board.taskRows.map((row) => {
        const card = buildTaskRowCardView(row);
        const selected = row.taskId === selectedTaskId;
        const progressView = buildTaskRowCursorProgressView({
          row,
          codeAgentWipExecutionV1,
          taskCursorExecutionV1,
          taskCursorExecutionHistoryV1,
          progressView: codeAgentProgress,
        });
        return (
          <button
            key={row.taskId}
            type="button"
            data-testid={`implementation-board-card-${row.taskId}`}
            onClick={() => onSelectTask(row.taskId)}
            style={{
              border: selected ? "1px solid #93c5fd" : "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "10px 12px",
              background: selected ? "#eff6ff" : "#fff",
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              minHeight: 44,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#2563eb" }}>{card.taskId}</div>
              {progressView?.isPolling ? (
                <span className={boardStyles.taskRowProgressBadge}>{progressView.shortLabel}</span>
              ) : null}
            </div>
            <div style={{ marginTop: 2, fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{card.title}</div>
            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: "#64748b", lineHeight: 1.4 }}>
              {card.priority} · {card.developerStatusLabel}
              <br />
              {card.reviewerStatusLabel} · {card.securityStatusLabel} · {card.scmStatusLabel}
              <br />
              재작업 {card.reworkCount} · 사용자 확인 {card.userConfirmationLabel}
            </div>
            {progressView ? <TaskRowCursorProgressBadge progress={progressView} /> : null}
          </button>
        );
      })}
    </>
  );
}

export function ImplementationExecutionBoardTable({
  board,
  selectedTaskId,
  codeAgentWipExecutionV1,
  taskCursorExecutionV1,
  taskCursorExecutionHistoryV1,
  codeAgentProgress,
  onSelectTask,
}: {
  readonly board: ImplementationExecutionBoardV1;
  readonly selectedTaskId: string | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistoryV1?: readonly TaskCursorExecutionV1[] | null;
  readonly codeAgentProgress?: CodeAgentExecutionProgressView | null;
  readonly onSelectTask: (taskId: string) => void;
}) {
  return (
    <div>
      <table style={tableStyle} data-testid="implementation-execution-board-table">
        <thead>
          <tr>
            {[
              "TASK ID",
              "작업명",
              "우선순위",
              "역할",
              "개발",
              "검수",
              "보안",
              "SCM",
              "사용자 확인",
              "재작업",
              "상태",
            ].map((label) => (
              <th key={label} style={thStyle}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {board.taskRows.map((row) => {
            const overlay = buildImplementationExecutionBoardRowWipOverlay({
              row,
              codeAgentWipExecutionV1,
            });
            const progressView = buildTaskRowCursorProgressView({
              row,
              codeAgentWipExecutionV1,
              taskCursorExecutionV1,
              taskCursorExecutionHistoryV1,
              progressView: codeAgentProgress,
            });
            const selected = row.taskId === selectedTaskId;
            return (
              <tr
                key={row.taskId}
                data-testid={`implementation-board-row-${row.taskId}`}
                onClick={() => onSelectTask(row.taskId)}
                style={{
                  cursor: "pointer",
                  background: selected ? "#eff6ff" : "transparent",
                }}
              >
                <td style={tdStyle}>{row.taskId}</td>
                <td style={tdStyle}>
                  <div>{row.title}</div>
                  <WipHint overlay={overlay} />
                  {progressView ? <TaskRowCursorProgressBadge progress={progressView} /> : null}
                </td>
                <td style={tdStyle}>{row.priority}</td>
                <td style={tdStyle}>{formatImplementationBoardRoleKo(row.currentRole)}</td>
                <td style={{ ...tdStyle, ...statusTone(formatImplementationBoardStepStatusKo(row.developerStatus)) }}>
                  {formatImplementationBoardStepStatusKo(row.developerStatus)}
                </td>
                <td style={{ ...tdStyle, ...statusTone(formatImplementationBoardStepStatusKo(row.reviewerStatus)) }}>
                  {formatImplementationBoardStepStatusKo(row.reviewerStatus)}
                </td>
                <td style={{ ...tdStyle, ...statusTone(formatImplementationBoardStepStatusKo(row.securityStatus)) }}>
                  {formatImplementationBoardStepStatusKo(row.securityStatus)}
                </td>
                <td style={{ ...tdStyle, ...statusTone(formatImplementationBoardStepStatusKo(row.scmStatus)) }}>
                  {formatImplementationBoardStepStatusKo(row.scmStatus)}
                </td>
                <td style={tdStyle}>{formatImplementationBoardUserConfirmationKo(row.userConfirmation)}</td>
                <td style={tdStyle}>{row.reworkCount}</td>
                <td style={tdStyle}>{row.statusLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ImplementationExecutionBoardIntegratedTable({
  rows,
}: {
  readonly rows: readonly ImplementationExecutionBoardIntegratedRowV1[];
}) {
  if (!rows.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>통합 단계</div>
      <table style={tableStyle} data-testid="implementation-execution-board-integrated-table">
        <thead>
          <tr>
            {["단계", "상태", "재작업"].map((label) => (
              <th key={label} style={thStyle}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.step}>
              <td style={tdStyle}>{row.title}</td>
              <td style={{ ...tdStyle, ...statusTone(formatImplementationBoardStepStatusKo(row.status)) }}>
                {formatImplementationBoardStepStatusKo(row.status)}
              </td>
              <td style={tdStyle}>{row.reworkCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
