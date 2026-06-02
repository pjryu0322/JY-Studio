"use client";

import {
  buildRuntimeDiagnosticRows,
  formatRuntimeStateKo,
  parseImplementationRuntimeStateV1,
} from "@/lib/prototype/implementationRuntimeState";
import { parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import styles from "@/components/preview/implementationRuntimeDiagnosticsPanel.module.css";

export function ImplementationRuntimeDiagnosticsPanel({
  requirementsState,
  onClose,
}: {
  readonly requirementsState: Record<string, unknown>;
  readonly onClose: () => void;
}) {
  const runtime = parseImplementationRuntimeStateV1(requirementsState.implementationRuntimeStateV1);
  const rows = buildRuntimeDiagnosticRows({
    runtime,
    queue: parseCodeTaskExecutionQueueV1(requirementsState.codeTaskExecutionQueueV1),
    runs: parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1),
    taskCursor: parseTaskCursorExecutionV1(requirementsState.taskCursorExecutionV1),
  });

  return (
    <div className={styles.overlay} role="dialog" aria-label="Runtime 상태">
      <div className={styles.panel}>
        <header className={styles.header}>
          <h3>Runtime 상태</h3>
          <button type="button" className={styles.close} onClick={onClose}>
            닫기
          </button>
        </header>
        {runtime ? (
          <p className={styles.summary}>
            현재 Runtime: <strong>{formatRuntimeStateKo(runtime.runtimeState)}</strong>
            {runtime.activeCodeTaskId ? ` · CodeTask ${runtime.activeCodeTaskId}` : ""}
            {runtime.lastStateChangeAt ? ` · 갱신 ${runtime.lastStateChangeAt}` : ""}
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
              <th>Last Update</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.codeTaskId}>
                  <td>{row.codeTaskId}</td>
                  <td>{formatRuntimeStateKo(row.runtimeState)}</td>
                  <td>{row.cursorState}</td>
                  <td>{row.githubState}</td>
                  <td>{row.lastUpdate}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>표시할 CodeTask가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
