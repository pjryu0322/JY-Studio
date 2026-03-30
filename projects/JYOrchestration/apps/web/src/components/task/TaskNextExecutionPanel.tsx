"use client";

import { useEffect, useState } from "react";
import type { TaskItem } from "@/components/project-spec/types";

export type TaskOrchestrationPeek = {
  running: TaskItem | undefined;
  /** executionWorkflowStatus === pending_apply — 에이전트 종료 후 Git 반영 미확인 */
  pendingGitReflection?: TaskItem | undefined;
  nextReady: TaskItem | undefined;
  awaitingHuman: TaskItem[];
  lastFailed: TaskItem | null;
};

const EXECUTION_STEPS = [
  { key: "cursor_req", label: "Cursor 요청 완료" },
  { key: "code", label: "코드 생성" },
  { key: "git", label: "Git 반영 확인" },
  { key: "review", label: "리뷰 (대기 또는 생략)" },
  { key: "done", label: "완료" },
] as const;

/** 경과 시간(초)에 따른 현재 단계 인덱스 — 서버 스트림이 없을 때 UX용 추정 */
function stepIndexFromElapsed(seconds: number): number {
  if (seconds < 2) return 0;
  if (seconds < 6) return 1;
  if (seconds < 16) return 2;
  if (seconds < 32) return 3;
  return 4;
}

type StepUiState = "done" | "running" | "pending";

function stepStates(
  executionLoopBusy: boolean,
  activeIndex: number,
  gitReflectionPending: boolean
): StepUiState[] {
  if (gitReflectionPending && !executionLoopBusy) {
    const g: StepUiState[] = ["done", "done", "done", "running", "pending"];
    return g;
  }
  if (!executionLoopBusy) {
    return EXECUTION_STEPS.map(() => "pending");
  }
  return EXECUTION_STEPS.map((_, i) => {
    if (i < activeIndex) return "done";
    if (i === activeIndex) return "running";
    return "pending";
  });
}

function stepIcon(s: StepUiState): string {
  switch (s) {
    case "done":
      return "✔";
    case "running":
      return "⏳";
    default:
      return "·";
  }
}

type Props = {
  tasks: TaskItem[];
  loading: boolean;
  orchestration: TaskOrchestrationPeek;
  execSetupReady: boolean;
  executionLoopBusy: boolean;
  onStartExecution: () => void;
  /** Git 브랜치 설정 오류일 때 실행 환경으로 스크롤 */
  onScrollToExecutionSetup?: () => void;
  lastFailedIsGitBranchError?: boolean;
};

function primaryOnly(tasks: TaskItem[]) {
  return tasks.filter((t) => t.taskKind === "PRIMARY");
}

export function TaskNextExecutionPanel({
  tasks,
  loading,
  orchestration,
  execSetupReady,
  executionLoopBusy,
  onStartExecution,
  onScrollToExecutionSetup,
  lastFailedIsGitBranchError = false,
}: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!executionLoopBusy) {
      setElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [executionLoopBusy]);

  const activeStepIndex = executionLoopBusy ? stepIndexFromElapsed(elapsedSec) : -1;
  const gitReflectionPending = Boolean(orchestration.pendingGitReflection);
  const states = stepStates(executionLoopBusy, activeStepIndex, gitReflectionPending);

  const focusTask: TaskItem | null =
    orchestration.running ??
    orchestration.pendingGitReflection ??
    orchestration.nextReady ??
    orchestration.awaitingHuman[0] ??
    null;

  const cardTitle = orchestration.running
    ? "실행 중인 작업"
    : gitReflectionPending
      ? "Git 반영 확인 중"
      : "다음 작업";

  return (
    <div
      data-testid="task-next-execution-panel"
      style={{
        marginBottom: 12,
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        background: "linear-gradient(180deg, #f8fafc 0%, #fff 100%)",
        display: "grid",
        gap: 14,
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 900, color: "#94a3b8", letterSpacing: "0.06em", marginBottom: 6 }}>
          {cardTitle}
        </div>
        {loading ? (
          <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>불러오는 중…</p>
        ) : focusTask ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }}>{focusTask.name}</div>
            {focusTask.description?.trim() ? (
              <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                {focusTask.description.trim().slice(0, 320)}
                {focusTask.description.trim().length > 320 ? "…" : ""}
              </p>
            ) : (
              <p style={{ margin: "8px 0 0 0", fontSize: 13, color: "#94a3b8" }}>설명 없음</p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
            {primaryOnly(tasks).length === 0
              ? "생성된 Task가 없습니다. 실행 워크플로에서 초안을 확정하세요."
              : "지금 바로 둘 작업이 없습니다."}
          </p>
        )}
      </div>

      <div
        role="status"
        aria-live="polite"
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", letterSpacing: "0.05em", marginBottom: 8 }}>
          실행 단계
        </div>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {EXECUTION_STEPS.map((step, i) => {
            const st = states[i];
            const isRunning = st === "running";
            return (
              <li
                key={step.key}
                style={{
                  fontSize: 13,
                  color: isRunning ? "#0f172a" : "#64748b",
                  fontWeight: isRunning ? 800 : 500,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  lineHeight: 1.45,
                }}
              >
                <span style={{ width: 22, textAlign: "center", flexShrink: 0 }} aria-hidden>
                  {stepIcon(st)}
                </span>
                <span>
                  {step.label}
                  {isRunning && executionLoopBusy ? (
                    <span style={{ color: "#0d9488", marginLeft: 6 }}>중… (경과 {elapsedSec}s)</span>
                  ) : null}
                  {isRunning && gitReflectionPending && !executionLoopBusy && i === 3 ? (
                    <span style={{ color: "#b45309", marginLeft: 6, fontWeight: 600 }}>
                      중… (커밋·변경 파일 미확인 — 완료 처리 안 함)
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

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
            ⚠ 마지막 실행이 실패했습니다 (펼쳐서 보기)
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

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          data-testid="task-execution-start-primary"
          disabled={executionLoopBusy || !execSetupReady}
          onClick={() => onStartExecution()}
          style={{
            padding: "12px 22px",
            borderRadius: 10,
            border: "1px solid #0f766e",
            background: execSetupReady ? "#0d9488" : "#e2e8f0",
            color: execSetupReady ? "#fff" : "#94a3b8",
            fontWeight: 900,
            fontSize: 15,
            cursor: executionLoopBusy || !execSetupReady ? "not-allowed" : "pointer",
            boxShadow: execSetupReady && !executionLoopBusy ? "0 2px 8px rgba(13,148,136,0.25)" : "none",
          }}
        >
          {executionLoopBusy ? "진행 중" : "실행 시작"}
        </button>
        {!execSetupReady ? (
          <span style={{ fontSize: 13, color: "#b45309", maxWidth: 420, lineHeight: 1.45 }}>
            실행 환경 검증이 끝나야 시작할 수 있습니다.
          </span>
        ) : null}
      </div>
    </div>
  );
}
