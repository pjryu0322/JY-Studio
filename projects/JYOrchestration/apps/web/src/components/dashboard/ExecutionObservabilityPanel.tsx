"use client";

import type { CSSProperties } from "react";
import type { TaskItem } from "@/components/project-spec/types";
import type { TaskRunItem } from "@/components/task/TaskListSection";
import type { ProjectObservabilitySnapshot } from "@/lib/metrics/projectObservabilityTypes";
import { EXECUTION_WORKFLOW } from "@/lib/executionLoop/workflowConstants";

export type LiveExecutionOrchestrationPeek = {
  running: TaskItem | undefined;
  pendingGitReflection?: TaskItem | undefined;
  nextReady: TaskItem | undefined;
  awaitingHuman: TaskItem[];
  lastFailed: TaskItem | null;
};

export type ExecutionControlPhase = "READY" | "RUNNING" | "PAUSED" | "DONE";

type ExecutionObservabilityPanelProps = {
  data: ProjectObservabilitySnapshot | null;
  loading: boolean;
  errorMessage: string | null;
  live?: {
    tasks: TaskItem[];
    taskRunMap: Record<string, TaskRunItem | undefined>;
    loading: boolean;
    orchestration: LiveExecutionOrchestrationPeek;
    executionLoopBusy: boolean;
    executionLoopPaused: boolean;
    execSetupReady: boolean;
    executionLoopBanner: string | null;
    onStartExecution: () => void;
    onPauseLoop: () => void | Promise<void>;
    onResumeLoop: () => void | Promise<void>;
    onAbortLoop: () => void | Promise<void>;
    onScrollToExecutionSetup?: () => void;
    lastFailedIsGitBranchError?: boolean;
  } | null;
};

const cardStyle: CSSProperties = {
  border: "1px solid #e0e0e0",
  borderRadius: 10,
  padding: 14,
  background: "#fff",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

function primaryOnly(tasks: TaskItem[]) {
  return tasks.filter((t) => t.taskKind === "PRIMARY").sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** 실제로 Cursor/평가 HTTP가 도는 중인 워크플로만 (pending_apply는 ‘막힘’이지 서버가 돌고 있는 상태가 아님) */
function hasActiveWorkflowOnPrimary(primary: TaskItem[]): boolean {
  return primary.some((t) => {
    const w = String(t.executionWorkflowStatus ?? "").toLowerCase();
    return w === EXECUTION_WORKFLOW.RUNNING || w === EXECUTION_WORKFLOW.REVIEWING;
  });
}

function hasPendingApplyOnPrimary(primary: TaskItem[]): boolean {
  return primary.some(
    (t) => String(t.executionWorkflowStatus ?? "").toLowerCase() === EXECUTION_WORKFLOW.PENDING_APPLY
  );
}

/** 전부 워크플로 완료(done) — 실패만 있는 경우는 READY로 남겨 재실행 가능하게 함 */
function allPrimaryWorkflowDone(primary: TaskItem[]): boolean {
  if (primary.length === 0) return false;
  return primary.every((t) => {
    const w = String(t.executionWorkflowStatus ?? "").toLowerCase();
    return (
      w === EXECUTION_WORKFLOW.MERGED ||
      w === EXECUTION_WORKFLOW.DONE ||
      w === EXECUTION_WORKFLOW.PR_OPENED
    );
  });
}

function deriveControlPhase(args: {
  primary: TaskItem[];
  executionLoopPaused: boolean;
  executionLoopBusy: boolean;
}): ExecutionControlPhase {
  const { primary, executionLoopPaused, executionLoopBusy } = args;
  if (primary.length === 0) {
    return "READY";
  }
  if (executionLoopBusy || hasActiveWorkflowOnPrimary(primary)) {
    return "RUNNING";
  }
  if (executionLoopPaused) {
    return "PAUSED";
  }
  if (allPrimaryWorkflowDone(primary)) {
    return "DONE";
  }
  return "READY";
}

type RowKind =
  | "done"
  | "pr_opened"
  | "running"
  | "pending"
  | "failed"
  | "review_pending"
  | "review_rejected"
  | "merge_pending";

function deriveTaskRow(
  task: TaskItem,
  run: TaskRunItem | undefined,
  currentTaskId: string | null
): RowKind {
  const wf = String(task.executionWorkflowStatus ?? "").toLowerCase();
  const runSt = String(run?.status ?? "").toUpperCase();

  if (wf === EXECUTION_WORKFLOW.FAILED || runSt === "FAILED") {
    return "failed";
  }
  if (wf === EXECUTION_WORKFLOW.PR_OPENED) {
    return "pr_opened";
  }
  if (wf === EXECUTION_WORKFLOW.MERGED || wf === EXECUTION_WORKFLOW.DONE || task.status === "DONE") {
    return "done";
  }
  if (wf === EXECUTION_WORKFLOW.REVIEW_PENDING) return "review_pending";
  if (wf === EXECUTION_WORKFLOW.REVIEW_REJECTED) return "review_rejected";
  if (wf === EXECUTION_WORKFLOW.MERGE_PENDING) return "merge_pending";

  const activeWf =
    wf === EXECUTION_WORKFLOW.RUNNING ||
    wf === EXECUTION_WORKFLOW.PENDING_APPLY ||
    wf === EXECUTION_WORKFLOW.REVIEWING;

  if (task.id === currentTaskId && activeWf) {
    return "running";
  }

  if (task.id === currentTaskId && runSt === "PENDING" && activeWf) {
    return "running";
  }

  return "pending";
}

function rowIcon(kind: RowKind): string {
  switch (kind) {
    case "done":
      return "✔";
    case "pr_opened":
      return "P";
    case "running":
      return "→";
    case "review_pending":
      return "R";
    case "review_rejected":
      return "!";
    case "merge_pending":
      return "M";
    case "failed":
      return "❌";
    default:
      return "\u00a0";
  }
}

function wfLabel(wf: string | null | undefined): string {
  const v = String(wf ?? "").trim();
  if (!v) return "—";
  const w = v.toLowerCase();
  switch (w) {
    case EXECUTION_WORKFLOW.READY:
      return "READY";
    case EXECUTION_WORKFLOW.RUNNING:
      return "RUNNING (Cursor)";
    case EXECUTION_WORKFLOW.REVIEW_PENDING:
      return "REVIEW_PENDING";
    case EXECUTION_WORKFLOW.REVIEW_REJECTED:
      return "REVIEW_REJECTED";
    case EXECUTION_WORKFLOW.REVIEW_APPROVED:
      return "REVIEW_APPROVED";
    case EXECUTION_WORKFLOW.MERGE_PENDING:
      return "MERGE_PENDING";
    case EXECUTION_WORKFLOW.MERGED:
      return "MERGED";
    case EXECUTION_WORKFLOW.PR_OPENED:
      return "PR_OPENED";
    case EXECUTION_WORKFLOW.PENDING_APPLY:
      return "PENDING_APPLY";
    case EXECUTION_WORKFLOW.FAILED:
      return "FAILED";
    default:
      return v;
  }
}

function LiveExecutionBlock(props: NonNullable<ExecutionObservabilityPanelProps["live"]>) {
  const {
    tasks,
    taskRunMap,
    loading,
    orchestration,
    executionLoopBusy,
    executionLoopPaused,
    execSetupReady,
    executionLoopBanner,
    onStartExecution,
    onPauseLoop,
    onResumeLoop,
    onAbortLoop,
    onScrollToExecutionSetup,
    lastFailedIsGitBranchError = false,
  } = props;

  const primary = primaryOnly(tasks);
  const phase = deriveControlPhase({ primary, executionLoopPaused, executionLoopBusy });
  const pendingApplyHint = hasPendingApplyOnPrimary(primary);

  let currentTaskId: string | null =
    orchestration.running?.id ?? orchestration.pendingGitReflection?.id ?? null;
  if (!currentTaskId && executionLoopBusy && orchestration.nextReady) {
    currentTaskId = orchestration.nextReady.id;
  }

  const rows = primary.map((t) => ({
    task: t,
    kind: deriveTaskRow(t, taskRunMap[t.id], currentTaskId),
    run: taskRunMap[t.id],
  }));

  const completedCount = rows.filter((r) => r.kind === "done" || r.kind === "pr_opened").length;
  const totalCount = primary.length;
  const progressPct = totalCount > 0 ? Math.round((100 * completedCount) / totalCount) : 0;

  const startDisabled = !execSetupReady || executionLoopBusy || phase === "DONE" || primary.length === 0;

  const phaseLabel: Record<ExecutionControlPhase, string> = {
    READY: "READY",
    RUNNING: "RUNNING",
    PAUSED: "PAUSED",
    DONE: "DONE",
  };

  const btnBase: CSSProperties = {
    padding: "8px 14px",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    border: "1px solid #94a3b8",
  };

  return (
    <div
      data-testid="execution-live-orchestration"
      style={{
        marginBottom: 16,
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid #b0bec5",
        background: "linear-gradient(180deg, #f8fafc 0%, #fff 100%)",
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#37474f" }}>실행 제어 · 실시간 진행</div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.08em",
            padding: "4px 10px",
            borderRadius: 999,
            background:
              phase === "RUNNING"
                ? "#dbeafe"
                : phase === "PAUSED"
                  ? "#fef3c7"
                  : phase === "DONE"
                    ? "#d1fae5"
                    : "#e2e8f0",
            color: phase === "RUNNING" ? "#1e40af" : phase === "PAUSED" ? "#92400e" : phase === "DONE" ? "#065f46" : "#475569",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {phaseLabel[phase]}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        {phase === "READY" ? (
          <button
            type="button"
            disabled={startDisabled}
            onClick={() => onStartExecution()}
            style={{
              ...btnBase,
              background: startDisabled ? "#e2e8f0" : "#0d9488",
              color: startDisabled ? "#94a3b8" : "#fff",
              borderColor: startDisabled ? "#cbd5e1" : "#0f766e",
              cursor: startDisabled ? "not-allowed" : "pointer",
            }}
          >
            {executionLoopBusy ? "진행 중" : "실행 시작"}
          </button>
        ) : null}

        {phase === "RUNNING" ? (
          <>
            <button
              type="button"
              disabled={executionLoopBusy}
              onClick={() => void onPauseLoop()}
              style={{
                ...btnBase,
                background: executionLoopBusy ? "#f1f5f9" : "#f8fafc",
                color: "#334155",
                cursor: executionLoopBusy ? "wait" : "pointer",
              }}
            >
              일시정지
            </button>
            <button
              type="button"
              disabled={executionLoopBusy}
              onClick={() => void onAbortLoop()}
              style={{
                ...btnBase,
                background: executionLoopBusy ? "#f1f5f9" : "#fff1f2",
                color: "#9f1239",
                borderColor: "#fda4af",
                cursor: executionLoopBusy ? "wait" : "pointer",
              }}
            >
              중단
            </button>
          </>
        ) : null}

        {phase === "PAUSED" ? (
          <>
            <button
              type="button"
              disabled={executionLoopBusy}
              onClick={() => void onResumeLoop()}
              style={{
                ...btnBase,
                background: executionLoopBusy ? "#f1f5f9" : "#ecfdf5",
                color: "#065f46",
                borderColor: "#6ee7b7",
                cursor: executionLoopBusy ? "wait" : "pointer",
              }}
            >
              재개
            </button>
            <button
              type="button"
              disabled={executionLoopBusy}
              onClick={() => void onAbortLoop()}
              style={{
                ...btnBase,
                background: executionLoopBusy ? "#f1f5f9" : "#fff1f2",
                color: "#9f1239",
                borderColor: "#fda4af",
                cursor: executionLoopBusy ? "wait" : "pointer",
              }}
            >
              중단
            </button>
          </>
        ) : null}

        {phase === "DONE" ? (
          <span style={{ fontSize: 13, color: "#065f46", fontWeight: 700 }}>
            모든 PRIMARY Task의 실행 워크플로가 완료(done)입니다.
          </span>
        ) : null}

        {!execSetupReady && phase === "READY" ? (
          <span style={{ fontSize: 12, color: "#b45309", lineHeight: 1.45 }}>
            실행 환경 검증을 완료한 뒤 실행할 수 있습니다.{" "}
            {onScrollToExecutionSetup ? (
              <button
                type="button"
                onClick={() => onScrollToExecutionSetup()}
                style={{
                  marginLeft: 2,
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "#1d4ed8",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: 12,
                }}
              >
                실행 환경 설정 열기
              </button>
            ) : null}
          </span>
        ) : null}

        {pendingApplyHint && phase === "READY" && execSetupReady ? (
          <span style={{ fontSize: 12, color: "#9a3412", lineHeight: 1.45, maxWidth: 520 }}>
            Git 반영이 플랫폼에서 확인되지 않은 Task(pending_apply)가 있습니다. 아래 「실행 시작」으로 해당 Task를
            다시 시도하세요. (PR/푸시는 되었어도 Cursor API 응답만으로는 막힐 수 있습니다.)
          </span>
        ) : null}
      </div>

      <div
        role="status"
        aria-live="polite"
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>진행률 (PRIMARY 완료 기준)</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
          {completedCount} / {totalCount} · {progressPct}%
        </div>
        <div
          style={{
            marginTop: 8,
            height: 8,
            borderRadius: 6,
            background: "#e2e8f0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPct}%`,
              background: "#0d9488",
              transition: "width 0.35s ease",
            }}
          />
        </div>
      </div>

      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 8 }}>
          현재 작업
        </div>
        {loading ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>불러오는 중…</p>
        ) : (() => {
          const cur = primary.find((t) => t.id === currentTaskId);
          if (!cur) {
            return (
              <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
                {primary.length === 0
                  ? "현재 실행 계획에 확정된 PRIMARY Task가 없습니다."
                  : "진행 중인 Task가 없습니다."}
              </p>
            );
          }
          return (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }}>{cur.name}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                워크플로: <strong style={{ color: "#334155" }}>{wfLabel(cur.executionWorkflowStatus)}</strong>
                {taskRunMap[cur.id] ? (
                  <>
                    {" "}
                    · TaskRun: <strong style={{ color: "#334155" }}>{taskRunMap[cur.id]!.status}</strong>
                  </>
                ) : null}
              </div>
              {cur.description?.trim() ? (
                <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                  {cur.description.trim().slice(0, 320)}
                  {cur.description.trim().length > 320 ? "…" : ""}
                </p>
              ) : null}
            </>
          );
        })()}
      </div>

      <div
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>Task 진행 (PRIMARY)</div>
        {loading ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>불러오는 중…</p>
        ) : primary.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>PRIMARY Task가 없습니다.</p>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
            {rows.map(({ task, kind, run }) => {
              const isCurrent = task.id === currentTaskId && kind === "running";
              return (
                <li
                  key={task.id}
                  style={{
                    fontSize: 13,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    lineHeight: 1.45,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: isCurrent ? "2px solid #0d9488" : "1px solid transparent",
                    background: isCurrent ? "#ecfdf5" : "transparent",
                    color: kind === "failed" ? "#991b1b" : "#334155",
                    fontWeight: isCurrent ? 800 : 500,
                  }}
                >
                  <span style={{ width: 22, textAlign: "center", flexShrink: 0, fontFamily: "monospace" }} aria-hidden>
                    {rowIcon(kind)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {task.name}
                    <span style={{ display: "block", fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>
                      wf {wfLabel(task.executionWorkflowStatus)}
                      {run ? ` · run ${run.status}` : " · run —"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <details
        style={{
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
          padding: "6px 10px",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 13,
            color: "#334155",
            listStyle: "none",
          }}
        >
          상세 보기 ▾
        </summary>
        <div style={{ marginTop: 10, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
          {executionLoopBanner ? (
            <p style={{ margin: "0 0 10px 0", whiteSpace: "pre-wrap" }} role="status">
              {executionLoopBanner}
            </p>
          ) : (
            <p style={{ margin: "0 0 10px 0", color: "#94a3b8" }}>표시할 메시지가 없습니다.</p>
          )}
        </div>
      </details>

      {orchestration.lastFailed ? (
        <details
          style={{
            borderRadius: 10,
            border: "1px solid #fecaca",
            background: "#fffbeb",
            padding: "6px 10px",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 13,
              color: "#92400e",
              listStyle: "none",
            }}
          >
            ⚠ 마지막 실행 실패 (펼쳐서 보기)
          </summary>
          <div style={{ marginTop: 10, fontSize: 12, color: "#7c2d12", lineHeight: 1.5 }}>
            <strong>{orchestration.lastFailed.name}</strong>
            {orchestration.lastFailed.lastEvalSummary
              ? ` — ${String(orchestration.lastFailed.lastEvalSummary).slice(0, 280)}`
              : ""}
            {lastFailedIsGitBranchError && onScrollToExecutionSetup ? (
              <button
                type="button"
                onClick={() => onScrollToExecutionSetup()}
                style={{
                  display: "block",
                  marginTop: 10,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #ea580c",
                  background: "#fff",
                  fontWeight: 800,
                  fontSize: 12,
                  color: "#c2410c",
                  cursor: "pointer",
                }}
              >
                Git 브랜치 설정 수정하기
              </button>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function pct(part: number, whole: number): number {
  if (whole <= 0) {
    return 0;
  }
  return Math.round((100 * part) / whole);
}

function StackedBar(props: {
  segments: { key: string; value: number; color: string; label: string }[];
  total: number;
}) {
  const { segments, total } = props;
  if (total <= 0) {
    return (
      <div style={{ fontSize: 12, color: "#9e9e9e", marginTop: 6 }}>데이터 없음</div>
    );
  }
  const positive = segments.filter((s) => s.value > 0);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: "#f5f5f5" }}>
        {positive.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.value}`}
            style={{
              flex: s.value,
              minWidth: 3,
              background: s.color,
            }}
          />
        ))}
      </div>
      <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, fontSize: 12, color: "#555", lineHeight: 1.6 }}>
        {segments.map((s) => (
          <li key={s.key}>
            <span style={{ color: s.color, fontWeight: 600 }}>■</span> {s.label}: {s.value} (
            {pct(s.value, total)}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExecutionObservabilityPanel({
  data,
  loading,
  errorMessage,
  live,
}: ExecutionObservabilityPanelProps) {
  return (
    <section
      id="execution-orchestration-panel"
      data-testid="execution-observability-panel"
      data-ui-label="[O-5] Observability — Execution Metrics"
      style={{
        marginTop: 20,
        marginBottom: 8,
        padding: 16,
        borderRadius: 12,
        border: "1px solid #cfd8dc",
        background: "linear-gradient(180deg, #fafbfc 0%, #eceff1 100%)",
      }}
    >
      <h2 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700, color: "#263238" }}>
        실행 관측 (Execution Observability)
      </h2>
      <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#546e7a", lineHeight: 1.55 }}>
        Task·Run·Git 반영·실행 제어를 한곳에서 봅니다. 집계는 읽기 전용이며 파이프라인을 바꾸지 않습니다.
      </p>

      {live ? <LiveExecutionBlock {...live} /> : null}

      {loading ? (
        <p style={{ margin: 0, color: "#607d8b", fontSize: 14 }}>집계를 불러오는 중...</p>
      ) : null}
      {errorMessage ? (
        <p style={{ margin: 0, color: "#c62828", fontSize: 14 }}>{errorMessage}</p>
      ) : null}

      {!loading && !errorMessage && data ? (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px 20px",
              marginBottom: 14,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #eceff1",
              fontSize: 13,
              color: "#455a64",
            }}
          >
            <span>
              <strong style={{ color: "#546e7a" }}>활성 실행 계획</strong>{" "}
              <span style={{ color: "#90a4ae", fontSize: 12 }}>
                {data.currentSpecVersionId ? "버전 연결됨" : "미확정 — Task 집계 없음"}
              </span>
            </span>
            <span>
              <strong style={{ color: "#2e7d32" }}>Task 완료율</strong>{" "}
              {data.task.total > 0 ? `${pct(data.task.done, data.task.total)}%` : "—"}{" "}
              <span style={{ color: "#90a4ae", fontSize: 12 }}>(현재 실행 계획·DONE / 전체)</span>
            </span>
            <span>
              <strong style={{ color: "#c62828" }}>Task 실패율</strong>{" "}
              {data.task.total > 0 ? `${pct(data.task.failed, data.task.total)}%` : "—"}{" "}
              <span style={{ color: "#90a4ae", fontSize: 12 }}>(최신 Run FAILED / 전체)</span>
            </span>
            <span>
              <strong style={{ color: "#2e7d32" }}>Git 성공률</strong>{" "}
              {data.git.total > 0 ? `${pct(data.git.done, data.git.total)}%` : "—"}{" "}
              <span style={{ color: "#90a4ae", fontSize: 12 }}>(apply DONE / 전체 요청)</span>
            </span>
            <span>
              <strong style={{ color: "#c62828" }}>Git 실패율</strong>{" "}
              {data.git.total > 0 ? `${pct(data.git.failed, data.git.total)}%` : "—"}{" "}
              <span style={{ color: "#90a4ae", fontSize: 12 }}>(apply FAILED / 전체 요청)</span>
            </span>
          </div>

          {data.historical.archivedTaskCount > 0 ||
          data.historical.promptRunCount > 0 ||
          data.historical.cursorRunCount > 0 ? (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fff8e1",
                border: "1px solid #ffe082",
                fontSize: 13,
                color: "#5d4037",
                lineHeight: 1.55,
              }}
            >
              <strong>이전 실행 계획(보관)</strong> · Task {data.historical.archivedTaskCount} · 프롬프트 Run{" "}
              {data.historical.promptRunCount} · Cursor 실행 기록 {data.historical.cursorRunCount}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#37474f" }}>Task</h3>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#263238" }}>{data.task.total}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#78909c" }}>현재 확정 실행 계획 기준</p>
              <StackedBar
                total={data.task.total}
                segments={[
                  { key: "todo", value: data.task.todo, color: "#90a4ae", label: "TODO·기타" },
                  { key: "running", value: data.task.running, color: "#ff9800", label: "실행 중(Run PENDING)" },
                  { key: "done", value: data.task.done, color: "#43a047", label: "완료(DB DONE)" },
                  { key: "failed", value: data.task.failed, color: "#e53935", label: "실패(Run FAILED)" },
                ]}
              />
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#37474f" }}>TaskRun</h3>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#263238" }}>{data.taskRun.total}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#78909c" }}>
                프롬프트 실행 이력 (현재 실행 계획 Task)
              </p>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#37474f" }}>
                Cursor 실행
              </h3>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#263238" }}>
                {data.cursorExecutionRun.activeCount}
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#78909c" }}>
                보관 {data.cursorExecutionRun.archivedCount} (이전 실행 계획)
              </p>
            </div>

            <div style={{ ...cardStyle, gridColumn: "span 2" }}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#37474f" }}>
                Git 반영 요청
              </h3>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#263238" }}>{data.git.total}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#78909c" }}>applyStatus 기준 분포</p>
              <StackedBar
                total={data.git.total}
                segments={[
                  { key: "req", value: data.git.requested, color: "#78909c", label: "대기(PENDING 등)" },
                  { key: "app", value: data.git.applying, color: "#29b6f6", label: "반영 중(APPLYING)" },
                  { key: "done", value: data.git.done, color: "#66bb6a", label: "완료(DONE)" },
                  { key: "fail", value: data.git.failed, color: "#ef5350", label: "실패(FAILED)" },
                ]}
              />
              <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#546e7a", lineHeight: 1.55 }}>
                GitHub PR 연결: <strong>{data.git.pullRequest.linked}</strong> · OPEN:{" "}
                <strong>{data.git.pullRequest.open}</strong> · 병합 반영:{" "}
                <strong>{data.git.pullRequest.merged}</strong>
              </p>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: 14, fontWeight: 700, color: "#37474f" }}>Retry</h3>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#6a1b9a" }}>{data.retry.total}</p>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#78909c" }}>
                재시도가 1회 이상 있는 Git 요청 건수
              </p>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
