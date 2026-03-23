"use client";

import { useEffect, useRef } from "react";
import type { IdeaGuidedUxSnapshot } from "@/lib/onboarding/ideaGuidedUx";
import {
  IDEA_UX_STEP_LABELS,
  type IdeaUxActionId,
  type IdeaUxPrimaryAction,
} from "@/lib/onboarding/ideaGuidedUx";

const STORAGE_RECOMMENDED = "jyorchestration-idea-ux-recommended";
const STORAGE_ADVANCED = "jyorchestration-idea-ux-advanced";

const AUTO_CHAIN_ACTIONS: IdeaUxActionId[] = [
  "run_parse",
  "generate_tasks",
  "generate_prompt",
];

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
  showAdvancedUi: boolean;
  onShowAdvancedUiChange: (value: boolean) => void;
  failureLines: string[];
  actionBusy: boolean;
  onPrimaryAction: (action: IdeaUxPrimaryAction) => void;
};

export function IdeaGuidedUx({
  snapshot,
  recommendedMode,
  onRecommendedModeChange,
  showAdvancedUi,
  onShowAdvancedUiChange,
  failureLines,
  actionBusy,
  onPrimaryAction,
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
      if (r === "1") {
        onRecommendedModeChange(true);
      }
      const a = window.localStorage.getItem(STORAGE_ADVANCED);
      if (a === "1") {
        onShowAdvancedUiChange(true);
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

  const persistAdvanced = (v: boolean) => {
    onShowAdvancedUiChange(v);
    try {
      window.localStorage.setItem(STORAGE_ADVANCED, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!recommendedMode) {
      return;
    }
    scrollToAnchor(snapshot.scrollAnchor);
  }, [recommendedMode]);

  useEffect(() => {
    if (!recommendedMode) {
      return;
    }
    if (prevStepRef.current !== snapshot.currentStep) {
      prevStepRef.current = snapshot.currentStep;
      scrollToAnchor(snapshot.scrollAnchor);
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
    onPrimaryAction(a);
  }, [recommendedMode, actionBusy, snapshot.primaryAction, onPrimaryAction]);

  const primary = snapshot.primaryAction;
  const isScrollOnly =
    primary.id === "scroll_upload" ||
    primary.id === "scroll_history" ||
    primary.id === "scroll_tasks" ||
    primary.id === "scroll_git";

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
            const active = s.id === snapshot.currentStep && !snapshot.allComplete;
            return (
              <span
                key={s.id}
                style={{
                  fontSize: 11,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: active ? "2px solid #1565c0" : "1px solid #cfd8dc",
                  background: s.done ? "#e8f5e9" : active ? "#e3f2fd" : "#fafafa",
                  color: s.done ? "#2e7d32" : active ? "#0d47a1" : "#757575",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {s.done ? "✓ " : ""}
                {label.short}
              </span>
            );
          })}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
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
            추천 모드 (단계 바뀔 때 해당 섹션으로 스크롤·안전한 단계만 자동 실행)
          </label>
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
              checked={showAdvancedUi}
              onChange={(e) => persistAdvanced(e.target.checked)}
            />
            고급 보기
          </label>
        </div>
      </nav>

      <section
        id="idea-ux-action-panel"
        style={{
          marginBottom: 18,
          padding: "14px 16px",
          borderRadius: 12,
          border: "1px solid #90caf9",
          background: "linear-gradient(180deg, #f5f9ff 0%, #fff 55%)",
        }}
        aria-label="다음 행동"
      >
        <p style={{ margin: "0 0 4px 0", fontSize: 12, color: "#1565c0", fontWeight: 700 }}>
          지금 단계 · {IDEA_UX_STEP_LABELS[snapshot.currentStep].title}
          {snapshot.allComplete ? " (완료)" : ""}
        </p>
        <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "#263238", lineHeight: 1.55 }}>
          {primary.description}
        </p>

        {failureLines.length > 0 ? (
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
            <strong>문제</strong>
            <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
              {failureLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p style={{ margin: "8px 0 0 0", fontSize: 12 }}>
              아래 「{primary.label}」로 다시 시도하거나 권한·설정을 확인하세요.
            </p>
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            disabled={actionBusy || primary.id === "none"}
            onClick={() => onPrimaryAction(primary)}
            style={{
              padding: "10px 18px",
              fontSize: 15,
              fontWeight: 600,
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
              onClick={() => scrollToAnchor(snapshot.scrollAnchor)}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid #90caf9",
                background: "#fff",
                color: "#1565c0",
                cursor: "pointer",
              }}
            >
              관련 화면으로 이동
            </button>
          )}
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid #e3f2fd",
            display: "flex",
            flexWrap: "wrap",
            gap: "12px 20px",
            fontSize: 13,
            color: "#37474f",
          }}
        >
          <span>
            {snapshot.achievements.taskRunReady ? "✔ " : "○ "}
            Task 실행·준비
          </span>
          <span>
            {snapshot.achievements.gitApplyDone ? "✔ " : "○ "}
            Git 반영 완료
          </span>
          <span>
            {snapshot.achievements.prLinked ? "✔ " : "○ "}
            PR 연결
          </span>
        </div>
      </section>
    </>
  );
}
