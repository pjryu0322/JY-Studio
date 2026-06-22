"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RequirementsPromptPresenterView } from "@/lib/requirements/promptPresenter";

export function RequirementsPromptView({
  open,
  onToggle,
  view,
  variant = "pill",
}: {
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly view: RequirementsPromptPresenterView | null;
  readonly variant?: "pill" | "menu";
}) {  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    if (!view) return;
    const text = view.copyText;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 900);
    } catch {
      // fallback: ignore
    }
  }, [view]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="relative" style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>        <button
          type="button"
          onClick={onToggle}
          style={{
            width: variant === "menu" ? "100%" : undefined,
            padding: variant === "menu" ? "10px 12px" : "8px 12px",
            borderRadius: variant === "menu" ? 10 : 999,
            border: "1px solid #e5e7eb",
            background: open ? "#ecfeff" : "#fff",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
            textAlign: variant === "menu" ? ("left" as const) : undefined,
          }}
        >
          {open ? "프롬프트 숨기기" : "AI 전달 프롬프트 보기"}
        </button>
      </div>

      {open && view ? (
        <section
          className="relative"
          style={{ position: "relative", border: "1px solid #e5e7eb", background: "#fff", borderRadius: 12, padding: "10px 12px" }}
        >          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900, color: "#0f172a" }}>{view.title}</div>
            <button
              type="button"
              onClick={() => void copy()}
              style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 10, padding: "6px 10px", fontWeight: 800, cursor: "pointer" }}
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10, fontSize: 13, color: "#0f172a", lineHeight: 1.6 }}>
            <div>
              <div style={{ fontWeight: 900 }}>역할</div>
              <div style={{ color: "#334155" }}>{view.roleText}</div>
            </div>
            <div>
              <div style={{ fontWeight: 900 }}>프로젝트</div>
              <div style={{ color: "#334155" }}>{view.projectName || "(이름 없음)"}</div>
            </div>
            <div>
              <div style={{ fontWeight: 900 }}>프로젝트 설명</div>
              <div style={{ color: "#334155" }}>{view.projectDescription || "(설명 없음)"}</div>
            </div>
            <div>
              <div style={{ fontWeight: 900 }}>현재 단계</div>
              <div style={{ color: "#334155" }}>{view.stageText}</div>
            </div>
            <div>
              <div style={{ fontWeight: 900 }}>최근 논의 요약</div>
              <ul style={{ margin: "6px 0 0 18px", color: "#334155" }}>
                {(view.recentSummaryBullets.length ? view.recentSummaryBullets : ["(아직 요약할 논의가 부족합니다)"]).map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
            <div>
              <div style={{ fontWeight: 900 }}>사용자 최신 질문</div>
              <div style={{ color: "#334155", whiteSpace: "pre-wrap" }}>{view.latestUserQuestion || "(없음)"}</div>
            </div>
            <div>
              <div style={{ fontWeight: 900 }}>선택 대상</div>
              <div style={{ color: "#334155" }}>{view.targetName}</div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

