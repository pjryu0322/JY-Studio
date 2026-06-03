"use client";

import { formatRuntimeStateKoForUser } from "@/lib/runtime/implementationRuntime/implementationRuntimeGithubCentricModel";
import {
  buildRuntimeDiagnosticRows,
  parseImplementationRuntimeStateV1,
} from "@/lib/prototype/implementationRuntimeState";
import { parseCodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ImplementationRuntimeDiagnosticsRow } from "@/lib/runtime/implementationRuntime/implementationRuntimeClient";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { hasDbImplementationRuntimeJob } from "@/lib/runtime/implementationRuntime/implementationRuntimeUiFlow";
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
  const useDbPrimary = hasDbImplementationRuntimeJob(dbBundle);
  const runtime = parseImplementationRuntimeStateV1(requirementsState.implementationRuntimeStateV1);
  const jsonRows = buildRuntimeDiagnosticRows({
    runtime,
    queue: parseCodeTaskExecutionQueueV1(requirementsState.codeTaskExecutionQueueV1),
    runs: parseCodeTaskExecutionRunsV1(requirementsState.codeTaskExecutionRunsV1),
    taskCursor: parseTaskCursorExecutionV1(requirementsState.taskCursorExecutionV1),
  });

  const dbCurrent = dbBundle?.currentRun;
  const dbJob = dbBundle?.job;
  const rows =
    useDbPrimary && dbDiagnostics?.length
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
          runtimeStateLabel: formatRuntimeStateKoForUser(row.runtimeState),
          cursorState: row.cursorState,
          githubState: row.githubState,
          lastUpdate: row.lastUpdate,
          heartbeat: null as string | null,
        }));

  const summaryState = dbCurrent?.runtimeState ?? runtime?.runtimeState;
  const summaryLabel = summaryState
    ? formatRuntimeStateKoForUser(summaryState, {
        commitSha: dbCurrent?.commitSha,
        pullRequestUrl: dbCurrent?.pullRequestUrl,
        githubState:
          dbCurrent?.runtimeState === "github_verifying"
            ? "pending"
            : dbCurrent?.commitSha
              ? "verified"
              : "none",
      })
    : null;

  return (
    <div className={styles.overlay} role="dialog" aria-label="Runtime 상태">
      <div className={styles.panel}>
        <header className={styles.header}>
          <h3>Runtime 진단</h3>
          <button type="button" className={styles.close} onClick={onClose}>
            닫기
          </button>
        </header>
        {useDbPrimary ? (
          <dl className={styles.summaryGrid}>
            <dt>Job 상태</dt>
            <dd>
              {dbJob ? (
                <>
                  <strong>{dbJob.status}</strong>
                  {dbJob.id ? ` · ${dbJob.id}` : ""}
                </>
              ) : (
                "—"
              )}
            </dd>
            <dt>Current CodeTask</dt>
            <dd>{dbJob?.currentCodeTaskId ?? dbCurrent?.codeTaskId ?? "—"}</dd>
            <dt>Run 상태</dt>
            <dd>{summaryLabel ?? "—"}</dd>
            <dt>Cursor Agent (진단)</dt>
            <dd>{dbCurrent?.cursorAgentId ?? "—"}</dd>
            <dt>GitHub 상태</dt>
            <dd>
              {dbCurrent?.runtimeState === "github_verifying"
                ? "pending"
                : dbCurrent?.commitSha
                  ? "verified"
                  : "none"}
            </dd>
            <dt>Heartbeat</dt>
            <dd>{dbCurrent?.lastHeartbeatAt ?? "—"}</dd>
          </dl>
        ) : (
          <>
            {summaryLabel ? (
              <p className={styles.summary}>
                현재 Runtime (legacy): <strong>{summaryLabel}</strong>
                {runtime?.activeCodeTaskId ? ` · CodeTask ${runtime.activeCodeTaskId}` : ""}
                {runtime?.lastStateChangeAt ? ` · 갱신 ${runtime.lastStateChangeAt}` : ""}
              </p>
            ) : (
              <p className={styles.summary}>Runtime 상태가 아직 기록되지 않았습니다.</p>
            )}
          </>
        )}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>CodeTask</th>
              <th>Run 상태</th>
              <th>Cursor Agent</th>
              <th>GitHub 상태</th>
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
