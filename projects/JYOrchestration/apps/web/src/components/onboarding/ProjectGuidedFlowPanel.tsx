"use client";

import { useCallback, useState } from "react";
import type { ProjectGuidedFlowSnapshot } from "@/lib/onboarding/projectGuidedFlow";
import { guidedFlowNextHint } from "@/lib/onboarding/projectGuidedFlow";

const STORAGE_COLLAPSED = "jyorchestration-guided-flow-collapsed";

type ProjectGuidedFlowPanelProps = {
  snapshot: ProjectGuidedFlowSnapshot;
  canRegisterSpec: boolean;
  canReview: boolean;
  canOperate: boolean;
};

function scrollToAnchor(anchorId: string) {
  const el = document.getElementById(anchorId);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function ProjectGuidedFlowPanel({
  snapshot,
  canRegisterSpec,
  canReview,
  canOperate,
}: ProjectGuidedFlowPanelProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    try {
      return window.localStorage.getItem(STORAGE_COLLAPSED) !== "0";
    } catch {
      return true;
    }
  });
  const [showAllSteps, setShowAllSteps] = useState(false);

  const persistCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_COLLAPSED, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const current = snapshot.steps.find((s) => s.id === snapshot.currentStepId);
  const nextText = guidedFlowNextHint({
    currentStepId: snapshot.currentStepId,
    canRegisterSpec,
    canReview,
    canOperate,
  });

  const doneCount = snapshot.steps.filter((s) => s.done).length;

  return (
    <section
      data-ui-label="[P-2-2] Stage Flow — Guided Flow Checklist | [F-1-1] Function — Onboarding Steps"
      style={{
        marginBottom: 20,
        border: "1px solid #c5cae9",
        borderRadius: 10,
        background: "linear-gradient(180deg, #f8f9ff 0%, #fff 48%)",
        overflow: "hidden",
      }}
      aria-label="온보딩 가이드"
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 14px",
          borderBottom: collapsed ? "none" : "1px solid #e8eaf6",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1a237e" }}>
            시작 가이드
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#5c6bc0", lineHeight: 1.45 }}>
            {snapshot.allComplete
              ? "흐름상 주요 단계를 모두 완료했습니다. 세부 기능은 아래에서 계속 이용할 수 있습니다."
              : `진행률 ${doneCount} / ${snapshot.steps.length} · 지금은 ${current?.shortTitle ?? ""} 단계입니다.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => persistCollapsed(!collapsed)}
          style={{
            padding: "6px 12px",
            fontSize: 13,
            borderRadius: 8,
            border: "1px solid #9fa8da",
            background: "#fff",
            cursor: "pointer",
            color: "#3949ab",
          }}
        >
          {collapsed ? "펼치기" : "접기"}
        </button>
      </div>

      {!collapsed ? (
        <div style={{ padding: "12px 14px 14px" }}>
          {!snapshot.allComplete ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "#e8eaf6",
                border: "1px solid #c5cae9",
                marginBottom: 12,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#283593" }}>
                다음에 할 일
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: 13, color: "#3949ab", lineHeight: 1.55 }}>
                {nextText}
              </p>
              {current?.anchorId ? (
                <button
                  type="button"
                  onClick={() => scrollToAnchor(current.anchorId!)}
                  style={{
                    marginTop: 10,
                    padding: "6px 12px",
                    fontSize: 13,
                    borderRadius: 8,
                    border: "none",
                    background: "#3949ab",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  관련 화면으로 이동
                </button>
              ) : null}
            </div>
          ) : null}

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#616161",
              marginBottom: 10,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showAllSteps}
              onChange={(e) => setShowAllSteps(e.target.checked)}
            />
            전체 단계 목록 보기
          </label>

          {showAllSteps || snapshot.allComplete ? (
            <>
              <ol
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontSize: 13,
                  color: "#424242",
                  lineHeight: 1.65,
                }}
              >
                {snapshot.steps.map((step) => (
                  <li key={step.id} style={{ marginBottom: 4 }}>
                    <span
                      style={{
                        fontWeight:
                          step.id === snapshot.currentStepId && !snapshot.allComplete ? 600 : 400,
                        color: step.done ? "#2e7d32" : "#424242",
                      }}
                    >
                      {step.title}
                      {step.done ? " ✓" : ""}
                    </span>
                    {step.anchorId ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() => scrollToAnchor(step.anchorId!)}
                          style={{
                            padding: "0 6px",
                            fontSize: 12,
                            border: "none",
                            background: "none",
                            color: "#5c6bc0",
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          이동
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ol>
              <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#757575", lineHeight: 1.5 }}>
                새 프로젝트는 앱 메인 페이지(/)에서 만든 뒤, 목록에서 열어 이 화면으로 들어옵니다.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
