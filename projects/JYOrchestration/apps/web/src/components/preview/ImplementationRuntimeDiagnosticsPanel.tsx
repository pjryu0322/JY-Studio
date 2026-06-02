"use client";

import {
  buildRuntimeDiagnosticRows,
  formatRuntimeStateKo,
  parseImplementationRuntimeStateV1,
} from "@/lib/prototype/implementationRuntimeState";
import { parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ImplementationRuntimeDiagnosticsRow } from "@/lib/runtime/implementationRuntime/implementationRuntimeClient";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import styles from "@/components/preview/implementationRuntimeDiagnosticsPanel.module.css";

export function ImplementationRuntimeDiagnosticsPanel({
  requirementsState,
  dbBundle,
  dbDiagnostics,
  onClose,
}: {
  readonly requirementsState: Record<string, unknown>;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly dbDiagnostics?: readonly ImplementationRuntimeDiagnosticsRow[] | null;
  readonly onClose: () => void;
}) {
  const runtime = parseImplementationRuntimeStateV1(requirementsState.implementationRuntimeStateV1);
  const jsonRows = buildRuntimeDiagnosticRows({
    runtime,
    queue: parseCodeTaskExecutionQueueV1(requirementsState.codeTaskExecutionQueueV1),
    runs: parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1),
    taskCursor: parseTaskCursorExecutionV1(requirementsState.taskCursorExecutionV1),
  });

  const dbCurrent = dbBundle?.currentRun;
  const rows =
    dbDiagnostics && dbDiagnostics.length
      ? dbDiagnostics.map((row) => ({
          codeTaskId: row.codeTaskId,
          runtimeState: row.runtimeState,
          runtimeStateLabel: row.runtimeStateLabel,
          cursorState: row.cursorState,
          githubState: row.githubState,
          lastUpdate: row.lastUpdate,
          heartbeat: row.heartbeat,
        }))
      : jsonRows.map((row) => ({
          codeTaskId: row.codeTaskId,
          runtimeState: row.runtimeState,
          runtimeStateLabel: formatRuntimeStateKo(row.runtimeState),
          cursorState: row.cursorState,
          githubState: row.githubState,
          lastUpdate: row.lastUpdate,
          heartbeat: null as string | null,
        }));

  const summaryState = dbCurrent?.runtimeState ?? runtime?.runtimeState;
  const summaryLabel = summaryState ? formatRuntimeStateKo(summaryState) : null;

  return (
    <div className={styles.overlay} role="dialog" aria-label="Runtime 상태">
      <div className={styles.panel}>
        <header className={styles.header}>
          <h3>Runtime 진단</h3>
          <button type="button" className={styles.close} onClick={onClose}>
            닫기
          </button>
        </header>
        {dbBundle?.job ? (
          <p className={styles.summary}>
            Job <strong>{dbBundle.job.id}</strong> · {dbBundle.job.status}
            {dbBundle.job.currentCodeTaskId ? ` · CodeTask ${dbBundle.job.currentCodeTaskId}` : ""}
          </p>
        ) : null}
        {summaryLabel ? (
          <p className={styles.summary}>
            현재 Runtime: <strong>{summaryLabel}</strong>
            {dbCurrent?.codeTaskId ?? runtime?.activeCodeTaskId
              ? ` · CodeTask ${dbCurrent?.codeTaskId ?? runtime?.activeCodeTaskId}`
              : ""}
            {dbCurrent?.lastHeartbeatAt
              ? ` · Heartbeat ${dbCurrent.lastHeartbeatAt}`
              : runtime?.lastStateChangeAt
                ? ` · 갱신 ${runtime.lastStateChangeAt}`
                : ""}
          </p>
        ) : (
          <p className={styles.summary}>Runtime 상태가 아직 기록되지 않았습니다.</p>
        )}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>CodeTask</th>
              <th>Runtime State</th>
              <th>Cursor State</th>
              <th>GitHub State</th>
              <th>Heartbeat</th>
              <th>Last Update</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.codeTaskId}>
                  <td>{row.codeTaskId}</td>
                  <td>{row.runtimeStateLabel}</td>
                  <td>{row.cursorState}</td>
                  <td>{row.githubState}</td>
                  <td>{row.heartbeat ?? "—"}</td>
                  <td>{row.lastUpdate}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>표시할 CodeTask가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
