"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  buildImplementationExecutionBoardSummaryView,
  dedupeImplementationStageNextActions,
  resolveImplementationExecutionBoardSelectedTaskId,
} from "@/lib/prototype/implementationExecutionBoardPanelView";
import {
  deriveImplementationStageNextActions,
  type ImplementationStageNextActionsBoardInput,
} from "@/lib/prototype/implementationStageNextActions";
import { deriveImplementationStageStatus } from "@/lib/prototype/implementationStageStatus";
import { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";
import type { EffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import {
  ImplementationExecutionBoardIntegratedTable,
  ImplementationExecutionBoardTable,
} from "@/components/preview/ImplementationExecutionBoardTable";
import { ImplementationExecutionBoardDetail } from "@/components/preview/ImplementationExecutionBoardDetail";

const shellStyle: CSSProperties = {
  flexShrink: 0,
  margin: "0 12px 10px",
  border: "1px solid #dbeafe",
  borderRadius: 14,
  background: "#fff",
  overflow: "hidden",
  boxShadow: "0 10px 30px -24px rgba(37, 99, 235, 0.35)",
};

const headerStyle: CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 8,
  padding: "10px 14px",
  borderBottom: "1px solid #f1f5f9",
};

const pillStyle = (tone: "ok" | "warn" | "muted"): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 10,
  fontWeight: 800,
  border: "1px solid",
  borderColor: tone === "ok" ? "#bbf7d0" : tone === "warn" ? "#fde68a" : "#e2e8f0",
  background: tone === "ok" ? "#ecfdf5" : tone === "warn" ? "#fffbeb" : "#f8fafc",
  color: tone === "ok" ? "#065f46" : tone === "warn" ? "#92400e" : "#64748b",
});

export function ImplementationExecutionBoardPanel({
  board,
  taskList,
  executionSetup,
  codeAgentWipExecutionV1,
  qualityGateResults,
  boardState,
  previewReady,
  effectiveImplementationState,
  boardInput,
  onAction,
}: {
  readonly board: ImplementationExecutionBoardV1;
  readonly taskList: ImplementationTaskListV1;
  readonly executionSetup?: ExecutionSetupSourceGenerationRow | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly qualityGateResults?: readonly ImplementationQualityGateResultV1[] | null;
  readonly boardState?: ImplementationExecutionBoardStateV1 | null;
  readonly previewReady?: boolean;
  readonly effectiveImplementationState: EffectiveImplementationState;
  readonly boardInput: ImplementationStageNextActionsBoardInput;
  readonly onAction: (label: string) => void;
}) {
  const summaryView = useMemo(
    () =>
      buildImplementationExecutionBoardSummaryView({
        board,
        executionSetup,
        previewReady,
        hasExecutionState: true,
        boardState,
      }),
    [board, executionSetup, previewReady, boardState],
  );

  const nextActions = useMemo(() => {
    const prototypeSnapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: effectiveImplementationState.latestRun,
      workUnits: effectiveImplementationState.latestRun?.workUnits,
    });
    const status = deriveImplementationStageStatus(
      effectiveImplementationState,
      boardInput.executionState,
    );
    return dedupeImplementationStageNextActions(
      deriveImplementationStageNextActions(
        status,
        boardInput.executionState,
        prototypeSnapshot,
        boardInput,
        {
          implementationSeedV1: effectiveImplementationState.implementationSeedV1,
          implementationTaskListV1: taskList,
        },
      ),
    );
  }, [effectiveImplementationState, boardInput, taskList]);

  const initialSelectedTaskId = useMemo(
    () =>
      resolveImplementationExecutionBoardSelectedTaskId({
        board,
        codeAgentWipExecutionV1,
      }),
    [board, codeAgentWipExecutionV1],
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialSelectedTaskId);
  useEffect(() => {
    setSelectedTaskId(initialSelectedTaskId);
  }, [initialSelectedTaskId]);

  const selectedRow = useMemo(
    () => board.taskRows.find((row) => row.taskId === selectedTaskId) ?? null,
    [board.taskRows, selectedTaskId],
  );

  const primaryActions = nextActions.filter((action) => action.priority === "primary").slice(0, 3);

  return (
    <section style={shellStyle} data-testid="implementation-execution-board-panel" aria-label="구현 Execution Board">
      <div style={headerStyle}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>구현 Execution Board</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {summaryView.envPills.map((pill) => (
            <span key={pill.label} style={pillStyle(pill.tone)}>
              {pill.label}: {pill.value}
            </span>
          ))}
        </div>
      </div>

      <div style={summaryGridStyle}>
        {[
          ["전체", board.summary.totalTasks],
          ["완료", board.summary.completedTasks],
          ["진행 중", board.summary.inProgressTasks],
          ["실패", board.summary.failedTasks],
          ["사용자 확인", board.summary.userConfirmationRequired],
          ["차단 확인", board.summary.blockingUserConfirmation],
          ["통합 완료", board.summary.integratedCompleted],
          ["Preview", summaryView.previewReady ? "준비됨" : "미준비"],
          ["검토단계", summaryView.testReadiness.ready ? "이동 가능" : "불가"],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{value}</div>
          </div>
        ))}
      </div>

      {primaryActions.length ? (
        <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {primaryActions.map((action) => (
            <button
              key={`${action.actionId}-${action.label}`}
              type="button"
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #2563eb",
                background: "#2563eb",
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
              onClick={() => onAction(action.label)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ padding: "0 14px 12px" }}>
        <ImplementationExecutionBoardTable
          board={board}
          selectedTaskId={selectedTaskId}
          codeAgentWipExecutionV1={codeAgentWipExecutionV1}
          onSelectTask={setSelectedTaskId}
        />
        <ImplementationExecutionBoardIntegratedTable rows={board.integratedRows} />
        <div style={{ marginTop: 12 }}>
          <ImplementationExecutionBoardDetail
            row={selectedRow}
            codeAgentWipExecutionV1={codeAgentWipExecutionV1}
            nextActions={nextActions}
            onAction={onAction}
          />
        </div>
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 800, color: "#475569" }}>
            환경설정 상세 보기
          </summary>
          <pre
            style={{
              marginTop: 8,
              fontSize: 10,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              color: "#334155",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 8,
            }}
          >
            {summaryView.envDiagnosticLines.join("\n") || "환경설정 정보 없음"}
          </pre>
        </details>
      </div>
    </section>
  );
}
