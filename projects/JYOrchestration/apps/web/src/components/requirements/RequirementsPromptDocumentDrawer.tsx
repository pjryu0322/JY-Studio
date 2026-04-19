"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { RequirementsPromptPresenterView } from "@/lib/requirements/promptPresenter";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  background: "rgba(15, 23, 42, 0.4)",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "stretch",
};

const panel: CSSProperties = {
  width: "min(960px, 100vw)",
  maxWidth: "100%",
  background: "#fafbfc",
  boxShadow: "-12px 0 48px rgba(15, 23, 42, 0.18)",
  display: "flex",
  flexDirection: "column",
  borderLeft: "1px solid #e2e8f0",
};

const docBlock: CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  padding: "18px 22px",
  marginBottom: 14,
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
};

const labelSm: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.04em",
  color: "#64748b",
  textTransform: "uppercase" as const,
  marginBottom: 6,
};

const bodyLg: CSSProperties = {
  fontSize: 15,
  lineHeight: 1.65,
  color: "#0f172a",
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
};

function formatSpeaker(m: RequirementsMessage): string {
  return m.speakerName?.trim() || (m.role === "user" ? "사용자" : m.role === "ai" ? "AI" : "시스템");
}

export function RequirementsPromptDocumentDrawer({
  open,
  onClose,
  view,
  lastPromptText,
  lastPromptGeneratedAt,
  conversationMessages,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly view: RequirementsPromptPresenterView | null | undefined;
  readonly lastPromptText?: string | null;
  readonly lastPromptGeneratedAt?: string | null;
  readonly conversationMessages: readonly RequirementsMessage[] | null;
}) {
  const show = useShowScreenLabels();
  const [tab, setTab] = useState<"prompt" | "history">("prompt");

  useEffect(() => {
    if (open) setTab("prompt");
  }, [open]);

  const generatedLabel = useMemo(() => {
    if (!lastPromptGeneratedAt) return null;
    try {
      return new Date(lastPromptGeneratedAt).toLocaleString("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return lastPromptGeneratedAt;
    }
  }, [lastPromptGeneratedAt]);

  const fullText = (lastPromptText && lastPromptText.trim()) || view?.copyText || "";

  const onCopy = useCallback(async () => {
    const t = fullText.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      /* ignore */
    }
  }, [fullText]);

  if (!open) return null;

  const hasPrompt = Boolean(view || fullText.trim());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="requirements-prompt-drawer-title"
      style={backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <ScreenLabel label="요구사항-프롬프트-드로어" visible={show} />
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
          }}
        >
          <h2 id="requirements-prompt-drawer-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a", flex: "1 1 auto" }}>
            프롬프트 · 대화
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setTab("prompt")}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: tab === "prompt" ? "1px solid #0d7377" : "1px solid #e2e8f0",
                background: tab === "prompt" ? "#ecfdf5" : "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                color: "#0f172a",
              }}
            >
              프롬프트
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: tab === "history" ? "1px solid #0d7377" : "1px solid #e2e8f0",
                background: tab === "history" ? "#ecfdf5" : "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                color: "#0f172a",
              }}
            >
              대화 기록
            </button>
            <button
              type="button"
              disabled={!fullText.trim()}
              onClick={() => void onCopy()}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: fullText.trim() ? "pointer" : "not-allowed",
                opacity: fullText.trim() ? 1 : 0.5,
              }}
            >
              프롬프트 복사
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                color: "#475569",
              }}
            >
              닫기
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "20px 22px 28px" }}>
          {tab === "prompt" ? (
            <>
              {generatedLabel ? (
                <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>마지막 생성: {generatedLabel}</p>
              ) : null}
              {!hasPrompt ? (
                <p style={{ ...bodyLg, color: "#64748b" }}>
                  아직 저장된 프롬프트가 없습니다. AI에 메시지를 보내거나 「정리 요청」을 실행하면 여기에 표시됩니다.
                </p>
              ) : (
                <>
                  {view ? (
                    <>
                      <div style={docBlock}>
                        <div style={labelSm}>역할</div>
                        <div style={bodyLg}>{view.roleText}</div>
                      </div>
                      <div style={docBlock}>
                        <div style={labelSm}>프로젝트명</div>
                        <div style={{ ...bodyLg, fontWeight: 700 }}>{view.projectName.trim() || "(이름 없음)"}</div>
                      </div>
                      <div style={docBlock}>
                        <div style={labelSm}>프로젝트 설명</div>
                        <div style={bodyLg}>{view.projectDescription.trim() || "(설명 없음)"}</div>
                      </div>
                      <div style={docBlock}>
                        <div style={labelSm}>최근 논의 요약</div>
                        {view.recentSummaryBullets.length ? (
                          <ul style={{ margin: 0, paddingLeft: 20, ...bodyLg }}>
                            {view.recentSummaryBullets.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        ) : (
                          <div style={{ ...bodyLg, color: "#64748b" }}>(아직 요약할 논의가 부족합니다)</div>
                        )}
                      </div>
                      <div style={docBlock}>
                        <div style={labelSm}>최신 사용자 질문</div>
                        <div style={bodyLg}>{view.latestUserQuestion.trim() || "(없음)"}</div>
                      </div>
                      <div style={labelSm}>질문 대상</div>
                      <div style={{ ...bodyLg, marginBottom: 14 }}>{view.targetName}</div>
                    </>
                  ) : null}
                  <div style={docBlock}>
                    <div style={labelSm}>실제 전달 프롬프트 텍스트</div>
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: "#0f172a",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {fullText.trim() || "(텍스트 없음)"}
                    </pre>
                  </div>
                </>
              )}
            </>
          ) : (
            <div style={docBlock}>
              <div style={labelSm}>대화 기록 (저장본 기준)</div>
              {!conversationMessages || conversationMessages.length === 0 ? (
                <div style={{ ...bodyLg, color: "#64748b" }}>표시할 메시지가 없습니다.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {conversationMessages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        background: m.role === "user" ? "#f8fafc" : m.role === "ai" ? "#fff" : "#fefce8",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>
                        {formatSpeaker(m)} · {m.createdAt ? new Date(m.createdAt).toLocaleString("ko-KR", { timeStyle: "short" }) : ""}
                      </div>
                      <div style={bodyLg}>{m.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
