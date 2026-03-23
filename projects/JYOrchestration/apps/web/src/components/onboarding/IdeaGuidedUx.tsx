"use client";

import { useEffect, useRef } from "react";
import type { IdeaGuidedUxSnapshot } from "@/lib/onboarding/ideaGuidedUx";
import {
  IDEA_UX_STEP_LABELS,
  type IdeaUxActionId,
  type IdeaUxPrimaryAction,
} from "@/lib/onboarding/ideaGuidedUx";

const STORAGE_RECOMMENDED = "jyorchestration-idea-ux-recommended";

const AUTO_CHAIN_ACTIONS: IdeaUxActionId[] = [
  "run_parse",
  "generate_tasks",
  "generate_prompt",
];

export type IdeaUxFailureAssist =
  | {
      kind: "run_failed";
      headline: string;
      shortCause: string;
      detailLines: string[];
      taskId: string;
    }
  | {
      kind: "git_failed";
      headline: string;
      shortCause: string;
      detailLines: string[];
      gitChangeRequestId: string;
    }
  | {
      kind: "generic";
      headline: string;
      shortCause: string;
      detailLines: string[];
    };

function scrollToAnchor(anchorId: string) {
  const el = document.getElementById(anchorId);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

type IdeaGuidedUxProps = {
  snapshot: IdeaGuidedUxSnapshot;
  recommendedMode: boolean;
  onRecommendedModeChange: (value: boolean) => void;
  failureAssist: IdeaUxFailureAssist | null;
  actionBusy: boolean;
  onPrimaryAction: (action: IdeaUxPrimaryAction) => void;
  /** 스크롤 전에 고급 섹션을 펼칠 때 (추천 모드) */
  onBeforeNavigateToAnchor?: (anchorId: string) => void;
};

export function IdeaGuidedUx({
  snapshot,
  recommendedMode,
  onRecommendedModeChange,
  failureAssist,
  actionBusy,
  onPrimaryAction,
  onBeforeNavigateToAnchor,
}: IdeaGuidedUxProps) {
  const lastAutoKeyRef = useRef<string>("");
  const prevStepRef = useRef<number>(snapshot.currentStep);

  useEffect(() => {
    if (!recommendedMode) {
      lastAutoKeyRef.current = "";
    }
  }, [recommendedMode]);

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }
    hydratedRef.current = true;
    try {
      const r = window.localStorage.getItem(STORAGE_RECOMMENDED);
      if (r === "0") {
        onRecommendedModeChange(false);
      } else {
        onRecommendedModeChange(true);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  const persistRecommended = (v: boolean) => {
    onRecommendedModeChange(v);
    try {
      window.localStorage.setItem(STORAGE_RECOMMENDED, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const navigateToAnchor = (anchorId: string) => {
    onBeforeNavigateToAnchor?.(anchorId);
    scrollToAnchor(anchorId);
  };

  useEffect(() => {
    if (!recommendedMode) {
      return;
    }
    onBeforeNavigateToAnchor?.(snapshot.scrollAnchor);
    scrollToAnchor(snapshot.scrollAnchor);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scroll when 추천 모드 is turned on
  }, [recommendedMode]);

  useEffect(() => {
    if (!recommendedMode) {
      return;
    }
    if (prevStepRef.current !== snapshot.currentStep) {
      prevStepRef.current = snapshot.currentStep;
      navigateToAnchor(snapshot.scrollAnchor);
    }
  }, [recommendedMode, snapshot.currentStep, snapshot.scrollAnchor]);

  useEffect(() => {
    if (!recommendedMode || actionBusy) {
      return;
    }
    const a = snapshot.primaryAction;
    if (!AUTO_CHAIN_ACTIONS.includes(a.id)) {
      return;
    }
    const key = `${a.id}:${a.uploadId ?? ""}:${a.taskId ?? ""}`;
    if (lastAutoKeyRef.current === key) {
      return;
    }
    lastAutoKeyRef.current = key;
    onBeforeNavigateToAnchor?.(snapshot.scrollAnchor);
    onPrimaryAction(a);
  }, [recommendedMode, actionBusy, snapshot.primaryAction, snapshot.scrollAnchor, onPrimaryAction, onBeforeNavigateToAnchor]);

  const primary = snapshot.primaryAction;
  const isScrollOnly =
    primary.id === "scroll_upload" ||
    primary.id === "scroll_history" ||
    primary.id === "scroll_tasks" ||
    primary.id === "scroll_git";

  const nextStepHighlight: number | null =
    !snapshot.allComplete && snapshot.currentStep < 7
      ? snapshot.currentStep + 1
      : null;

  const failureBlocksPrimary =
    failureAssist?.kind === "run_failed" || failureAssist?.kind === "git_failed";

  const m = snapshot.milestones;

  return (
    <>
      <nav
        aria-label="진행 단계"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          marginBottom: 14,
          padding: "10px 12px",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(8px)",
          borderRadius: 10,
          border: "1px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "#37474f" }}>진행 단계</span>
          {snapshot.steps.map((s) => {
            const label = IDEA_UX_STEP_LABELS[s.id];
            const isNextPeek = nextStepHighlight === s.id && s.status === "not_started";
            let mark = "○";
            if (s.status === "done") {
              mark = "✔";
            } else if (s.status === "current") {
              mark = "●";
            }
            return (
              <span
                key={s.id}
                title={`${label.title} (${s.status})`}
                style={{
                  fontSize: 11,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border:
                    s.status === "current"
                      ? "2px solid #1565c0"
                      : isNextPeek
                        ? "1px dashed #42a5f5"
                        : "1px solid #cfd8dc",
                  background:
                    s.status === "done"
                      ? "#e8f5e9"
                      : s.status === "current"
                        ? "#e3f2fd"
                        : isNextPeek
                          ? "#f1f8fe"
                          : "#fafafa",
                  color:
                    s.status === "done"
                      ? "#2e7d32"
                      : s.status === "current"
                        ? "#0d47a1"
                        : "#757575",
                  fontWeight: s.status === "current" ? 700 : 500,
                }}
              >
                {mark} {label.short}
              </span>
            );
          })}
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#455a64",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={recommendedMode}
            onChange={(e) => persistRecommended(e.target.checked)}
          />
          추천 모드 (Action Panel 중심 · 고급 기능은 접어 둠)
        </label>
      </nav>

      <section
        id="idea-ux-action-panel"
        style={{
          marginBottom: 18,
          padding: "16px 18px",
          borderRadius: 12,
          border: "2px solid #64b5f6",
          background: "linear-gradient(180deg, #f5f9ff 0%, #fff 55%)",
          boxShadow: "0 4px 18px rgba(21,101,192,0.08)",
        }}
        aria-label="다음 행동"
      >
        <p style={{ margin: "0 0 4px 0", fontSize: 12, color: "#1565c0", fontWeight: 700 }}>
          현재 단계 · {IDEA_UX_STEP_LABELS[snapshot.currentStep].title}
          {snapshot.allComplete ? " (완료)" : ""}
        </p>
        <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#546e7a", lineHeight: 1.5 }}>
          {failureBlocksPrimary && failureAssist
            ? failureAssist.shortCause
            : primary.description}
        </p>

        {failureAssist ? (
          <div
            role="alert"
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "#ffebee",
              border: "1px solid #ffcdd2",
              fontSize: 13,
              color: "#b71c1c",
              lineHeight: 1.5,
            }}
          >
            <strong>{failureAssist.headline}</strong>
            <p style={{ margin: "6px 0 0 0" }}>{failureAssist.shortCause}</p>
            {failureAssist.detailLines.length > 0 ? (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "#c62828" }}>
                  자세히 보기
                </summary>
                <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, fontSize: 12 }}>
                  {failureAssist.detailLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}

        {failureAssist?.kind === "run_failed" ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() =>
                onPrimaryAction({
                  id: "retry_run",
                  label: "다시 실행",
                  description: "",
                  taskId: failureAssist.taskId,
                })
              }
              style={{
                padding: "12px 22px",
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                background: actionBusy ? "#e0e0e0" : "#1565c0",
                color: "#fff",
                cursor: actionBusy ? "not-allowed" : "pointer",
              }}
            >
              {actionBusy ? "처리 중…" : "다시 실행"}
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() =>
                onPrimaryAction({
                  id: "follow_up",
                  label: "보완 작업 생성",
                  description: "",
                  taskId: failureAssist.taskId,
                })
              }
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 8,
                border: "1px solid #ef9a9a",
                background: "#fff",
                color: "#c62828",
                cursor: actionBusy ? "not-allowed" : "pointer",
              }}
            >
              보완 작업 생성
            </button>
          </div>
        ) : null}

        {failureAssist?.kind === "git_failed" ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() =>
                onPrimaryAction({
                  id: "retry_git_apply",
                  label: "Git 반영 재시도",
                  description: "",
                  gitChangeRequestId: failureAssist.gitChangeRequestId,
                })
              }
              style={{
                padding: "12px 22px",
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                background: actionBusy ? "#e0e0e0" : "#1565c0",
                color: "#fff",
                cursor: actionBusy ? "not-allowed" : "pointer",
              }}
            >
              {actionBusy ? "처리 중…" : "Git 반영 재시도"}
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() =>
                onPrimaryAction({
                  id: "scroll_git",
                  label: "Git 영역으로 이동",
                  description: "",
                })
              }
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 8,
                border: "1px solid #90caf9",
                background: "#fff",
                color: "#1565c0",
                cursor: "pointer",
              }}
            >
              Git 영역으로 이동
            </button>
          </div>
        ) : null}

        {!failureBlocksPrimary ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              disabled={actionBusy || primary.id === "none"}
              onClick={() => {
                onBeforeNavigateToAnchor?.(snapshot.scrollAnchor);
                onPrimaryAction(primary);
              }}
              style={{
                padding: "12px 22px",
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                background:
                  primary.id === "none" ? "#bdbdbd" : actionBusy ? "#e0e0e0" : "#1565c0",
                color: primary.id === "none" ? "#fff" : actionBusy ? "#9e9e9e" : "#fff",
                cursor:
                  actionBusy || primary.id === "none" ? "not-allowed" : "pointer",
              }}
            >
              {actionBusy ? "처리 중…" : primary.label}
            </button>
            {isScrollOnly ? null : (
              <button
                type="button"
                onClick={() => navigateToAnchor(snapshot.scrollAnchor)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e0e0e0",
                  background: "#fafafa",
                  color: "#90a4ae",
                  cursor: "pointer",
                }}
              >
                관련 화면으로 이동
              </button>
            )}
          </div>
        ) : null}

        {failureAssist?.kind === "generic" && !failureBlocksPrimary ? (
          <div style={{ marginTop: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#78909c" }}>
              위 안내를 확인한 뒤 아래 버튼으로 계속하세요.
            </p>
          </div>
        ) : null}

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid #e3f2fd",
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 16px",
            fontSize: 12,
            color: "#37474f",
          }}
        >
          <span style={{ fontWeight: 600, color: "#546e7a", width: "100%" }}>완료 체크</span>
          <span>{m.specUploaded ? "✔" : "○"} 스펙 업로드</span>
          <span>{m.parsed ? "✔" : "○"} 파싱</span>
          <span>{m.tasksCreated ? "✔" : "○"} Task 생성</span>
          <span>{m.promptsReady ? "✔" : "○"} 프롬프트</span>
          <span>{m.runSucceeded ? "✔" : "○"} 실행 성공</span>
          <span>{m.gitApplied ? "✔" : "○"} Git 반영</span>
          <span>{m.prLinked ? "✔" : "○"} PR 연결</span>
        </div>
      </section>
    </>
  );
}
