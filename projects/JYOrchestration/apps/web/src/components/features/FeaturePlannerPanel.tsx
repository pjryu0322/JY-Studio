"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RequirementsChatComposerFooter } from "@/components/requirements/RequirementsChatComposerFooter";
import { RequirementsChatHeaderRow } from "@/components/requirements/RequirementsChatHeaderRow";
import { RequirementsComposerGpt } from "@/components/requirements/RequirementsComposerGpt";
import type { FeatureWorkspaceChatMessageV1 } from "@/lib/requirements/requirementsStateJson";

/** `RequirementsChatPanel`과 동일한 사용자 말풍선(틸 그라데이션). */
const userBubble: CSSProperties = {
  maxWidth: "min(100%, 520px)",
  marginLeft: "auto",
  marginRight: 0,
  padding: "14px 16px",
  borderRadius: "18px 18px 6px 18px",
  background: "linear-gradient(180deg, #0f766e 0%, #0d5c56 100%)",
  color: "#fff",
  border: "none",
  fontSize: 15,
  lineHeight: 1.55,
  boxShadow: "0 10px 28px -14px rgba(13, 92, 86, 0.45)",
  whiteSpace: "pre-wrap",
};

function aiCardShell(tone: "default" | "notice") {
  const border = tone === "notice" ? "1px solid #bae6fd" : "1px solid #e2e8f0";
  const bg = tone === "notice" ? "#f0f9ff" : "#ffffff";
  return {
    maxWidth: "min(100%, 640px)",
    marginLeft: 0,
    marginRight: "auto",
    borderRadius: 14,
    border,
    background: bg,
    boxShadow: "0 8px 28px -18px rgba(15, 23, 42, 0.14)",
    overflow: "hidden" as const,
  };
}

function formatMsgTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export type FeaturePlannerProgressSummary = Readonly<{
  pct: number;
  filledStages: number;
  totalStages: number;
  featureCount: number;
  /** 기능이 아직 비어 있는 단계 수(우측 배지) */
  gapStageCount: number;
}>;

export function FeaturePlannerPanel({
  progressSummary,
  messages,
  composerValue,
  onComposerChange,
  onSend,
  onApplyReflect,
  onGapCheck,
  memberCount,
  onOpenMembers,
  busy,
  typingIndicator,
  saveError,
  embedded,
}: {
  readonly progressSummary: FeaturePlannerProgressSummary | null;
  readonly messages: readonly FeatureWorkspaceChatMessageV1[];
  readonly composerValue: string;
  readonly onComposerChange: (next: string) => void;
  readonly onSend: () => void;
  readonly onApplyReflect: () => void;
  readonly onGapCheck: () => void;
  readonly memberCount: number;
  readonly onOpenMembers: () => void;
  readonly busy: boolean;
  readonly typingIndicator?: boolean;
  readonly saveError?: boolean;
  /** 다열 레이아웃 안쪽 패널: 외곽 테두리 생략 */
  readonly embedded?: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const composerTaRef = useRef<HTMLTextAreaElement | null>(null);
  const headerRowRef = useRef<HTMLDivElement | null>(null);
  const [progressPopoverOpen, setProgressPopoverOpen] = useState(false);

  const pct = progressSummary?.totalStages ? progressSummary.pct : 0;
  const filled = progressSummary?.filledStages ?? 0;
  const total = progressSummary?.totalStages ?? 0;
  const featureCount = progressSummary?.featureCount ?? 0;
  const gapCount = progressSummary?.gapStageCount ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingIndicator]);

  useEffect(() => {
    if (!progressPopoverOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setProgressPopoverOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [progressPopoverOpen]);

  useEffect(() => {
    if (!progressPopoverOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (headerRowRef.current?.contains(t)) return;
      setProgressPopoverOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [progressPopoverOpen]);

  const toolsMenu = {
    onOrganizeRequirements: () => onGapCheck(),
    organizeDisabled: busy,
    organizeMenuTitle: "누락 기능 점검",
    draftViewAvailable: true,
    onOpenDraftView: () => onApplyReflect(),
    draftMenuTitle: "기능 반영",
  };

  const leadingProgress = (
    <div style={{ position: "relative", minWidth: 0 }}>
      <button
        type="button"
        onClick={() => setProgressPopoverOpen((v) => !v)}
        style={{
          border: "1px solid #cbd5e1",
          background: "#fff",
          borderRadius: 999,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 900,
          color: "#0f172a",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          maxWidth: "min(100%, 360px)",
        }}
        title="기능 정리 진행 상세"
      >
        <span style={{ whiteSpace: "nowrap" }}>기능 정리 {pct}%</span>
        <span style={{ color: "#94a3b8", fontWeight: 900 }}>·</span>
        <span style={{ whiteSpace: "nowrap", color: "#64748b", fontWeight: 700 }}>
          {filled}/{total}
        </span>
      </button>

      {progressPopoverOpen ? (
        <div
          role="dialog"
          aria-label="기능 정리 진행 상세"
          style={{
            position: "absolute",
            left: 0,
            top: "calc(100% + 8px)",
            zIndex: 6,
            width: "min(92vw, 420px)",
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            background: "#fff",
            boxShadow: "0 24px 64px -28px rgba(15, 23, 42, 0.35)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>
              기능 정리 {pct}% · {filled}/{total}
            </div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "#0f766e",
                  transition: "width 0.25s ease-out",
                }}
              />
            </div>
          </div>
          <div style={{ padding: 12, fontSize: 12.5, fontWeight: 700, color: "#334155", lineHeight: 1.5 }}>
            누적 기능 항목 <strong style={{ color: "#0f172a" }}>{featureCount}</strong>개 · 비어 있는 단계{" "}
            <strong style={{ color: gapCount > 0 ? "#b45309" : "#0f172a" }}>{gapCount}</strong>개
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <section
      aria-label="기능 정리 AI기획자"
      style={{
        display: "flex",
        flexDirection: "column",
        flex: "1 1 auto",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        border: embedded ? "none" : "1px solid #e2e8f0",
        borderRadius: embedded ? 0 : 14,
        background: "#fff",
      }}
    >
      {/* 대화창(헤더행 + 스크롤) + 입력창 */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {saveError ? (
          <div
            role="alert"
            style={{
              flexShrink: 0,
              padding: "8px 12px",
              borderBottom: "1px solid #fecaca",
              background: "#fef2f2",
              fontSize: 12,
              fontWeight: 800,
              color: "#991b1b",
              lineHeight: 1.45,
            }}
          >
            저장에 실패했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        ) : null}
        <RequirementsChatHeaderRow
          ref={headerRowRef}
          variant="panel"
          memberControls={{ count: memberCount, onOpen: onOpenMembers }}
          leading={leadingProgress}
        />

        <div
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "18px 18px 12px",
            background: "linear-gradient(180deg, #f1f5f9 0%, #eef2f7 50%, #f8fafc 100%)",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto", width: "100%", minWidth: 0 }}>
            {messages.length === 0 ? (
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>협의 메시지가 여기에 표시됩니다.</div>
            ) : null}

            {messages.map((m) => {
              const mine = m.role === "user";
              const time = formatMsgTime(m.at);

              if (mine) {
                const meta = (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#71717a",
                      paddingRight: 4,
                      textAlign: "right",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: 8,
                    }}
                  >
                    <span>{`나 · ${time}`}</span>
                  </div>
                );
                return (
                  <div key={m.id} style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={userBubble}>{m.text}</div>
                    {meta}
                  </div>
                );
              }

              return (
                <div key={m.id} style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={aiCardShell("default")}>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid rgba(148, 163, 184, 0.35)",
                        background: "#f1f5f9",
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#475569",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <span>AI · AI 기획자</span>
                      <span style={{ fontWeight: 700, color: "#94a3b8" }}>{time}</span>
                    </div>
                    <div style={{ padding: "12px 14px 14px", fontSize: 15, color: "#0f172a", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })}

            {typingIndicator ? (
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 11, color: "#71717a", paddingLeft: 4, textAlign: "left" }}>
                  AI · AI 기획자 · {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div style={aiCardShell("notice")}>
                  <div style={{ padding: "14px 16px", fontSize: 15, color: "#0f172a" }}>
                    <span style={{ fontWeight: 800, marginRight: 6 }}>생각 중입니다</span>
                    <span className="jyo-feature-typing" aria-label="typing indicator">
                      <span className="jyo-feature-dot" />
                      <span className="jyo-feature-dot" />
                      <span className="jyo-feature-dot" />
                    </span>
                    <style>{`
                      .jyo-feature-typing { display: inline-flex; gap: 4px; vertical-align: middle; }
                      .jyo-feature-dot { width: 6px; height: 6px; border-radius: 999px; background: #0f766e; opacity: 0.35; animation: jyoFeatureDot 1.2s infinite; }
                      .jyo-feature-dot:nth-child(2) { animation-delay: 0.15s; }
                      .jyo-feature-dot:nth-child(3) { animation-delay: 0.3s; }
                      @keyframes jyoFeatureDot { 0%, 80%, 100% { transform: translateY(0); opacity: 0.25; } 40% { transform: translateY(-3px); opacity: 0.9; } }
                    `}</style>
                  </div>
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        </div>

        <RequirementsChatComposerFooter>
          <RequirementsComposerGpt
            textAreaRef={composerTaRef}
            value={composerValue}
            onChange={onComposerChange}
            onSend={onSend}
            busy={busy}
            disabled={false}
            placeholder="메시지를 입력하세요"
            toolsMenu={toolsMenu}
          />
        </RequirementsChatComposerFooter>
      </div>
    </section>
  );
}
