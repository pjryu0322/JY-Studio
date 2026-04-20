"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  position: "relative",
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

const actionBarBtn: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  color: "#0f172a",
};

function formatSpeaker(m: RequirementsMessage): string {
  const n = m.speakerName?.trim();
  if (n) return n;
  if (m.role === "user") return "사용자";
  if (m.role === "ai") return "AI";
  if (m.role === "human") return "멤버";
  return "시스템";
}

function sanitizeExportFileStem(name: string): string {
  const trimmed = name.trim().slice(0, 80);
  const base = trimmed.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "");
  return base.length > 0 ? base : "project";
}

function localDateSlug(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildExportBasename(exportBaseName: string | null | undefined): string {
  return sanitizeExportFileStem(exportBaseName ?? "");
}

function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

function messagesToJsonLines(messages: readonly RequirementsMessage[]): string {
  const rows = messages.map((m) => ({
    role: m.role,
    speaker: formatSpeaker(m),
    content: m.content,
    createdAt: m.createdAt,
  }));
  return `${JSON.stringify(rows, null, 2)}\n`;
}

function messagesToTxt(messages: readonly RequirementsMessage[]): string {
  return messages
    .map((m) => {
      const who = formatSpeaker(m);
      const when = m.createdAt ? new Date(m.createdAt).toISOString() : "";
      return `[${m.role}] ${who} · ${when}\n${m.content}`;
    })
    .join("\n\n---\n\n");
}

function ClipboardIcon({ size = 20 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function RequirementsPromptDocumentDrawer({
  open,
  onClose,
  view,
  lastPromptText,
  lastPromptGeneratedAt,
  conversationMessages,
  exportBaseName,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly view: RequirementsPromptPresenterView | null | undefined;
  readonly lastPromptText?: string | null;
  readonly lastPromptGeneratedAt?: string | null;
  readonly conversationMessages: readonly RequirementsMessage[] | null;
  /** 다운로드 파일명 접두사(예: 프로젝트명). 비어 있으면 `project` 사용 */
  readonly exportBaseName?: string | null;
}) {
  const show = useShowScreenLabels();
  const [tab, setTab] = useState<"prompt" | "history">("prompt");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [copyToastVisible, setCopyToastVisible] = useState(false);
  const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) setTab("prompt");
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      return;
    }
    if (!conversationMessages?.length) {
      setSelectedIds(new Set());
      return;
    }
    const valid = new Set(conversationMessages.map((m) => m.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
      }
      return next;
    });
  }, [open, conversationMessages]);

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) {
        clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = null;
      }
    };
  }, []);

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

  const exportStem = useMemo(() => buildExportBasename(exportBaseName), [exportBaseName]);

  const orderedMessages = conversationMessages ?? [];

  const allMessageIds = useMemo(() => orderedMessages.map((m) => m.id), [orderedMessages]);

  const allSelected = useMemo(
    () => allMessageIds.length > 0 && allMessageIds.every((id) => selectedIds.has(id)),
    [allMessageIds, selectedIds]
  );

  const showCopyToast = useCallback(() => {
    if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    setCopyToastVisible(true);
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToastVisible(false);
      copyToastTimerRef.current = null;
    }, 2000);
  }, []);

  const onCopyPrompt = useCallback(async () => {
    const t = fullText.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      showCopyToast();
    } catch {
      /* ignore */
    }
  }, [fullText, showCopyToast]);

  const toggleSelectAll = useCallback(() => {
    if (!orderedMessages.length) return;
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allMessageIds));
  }, [allMessageIds, allSelected, orderedMessages.length]);

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const downloadPair = useCallback(
    (messages: readonly RequirementsMessage[]) => {
      if (!messages.length) return;
      const date = localDateSlug();
      const base = `${exportStem}-chat-${date}`;
      downloadTextFile(`${base}.txt`, messagesToTxt(messages), "text/plain;charset=utf-8");
      window.setTimeout(() => {
        downloadTextFile(`${base}.json`, messagesToJsonLines(messages), "application/json;charset=utf-8");
      }, 200);
    },
    [exportStem]
  );

  const onSaveSelected = useCallback(() => {
    const picked = orderedMessages.filter((m) => selectedIds.has(m.id));
    if (!picked.length) return;
    downloadPair(picked);
  }, [downloadPair, orderedMessages, selectedIds]);

  const onSaveAll = useCallback(() => {
    if (!orderedMessages.length) return;
    downloadPair(orderedMessages);
  }, [downloadPair, orderedMessages]);

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
        {copyToastVisible ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "absolute",
              top: 56,
              right: 16,
              zIndex: 2,
              padding: "8px 14px",
              borderRadius: 10,
              background: "#0f172a",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",
              maxWidth: "min(320px, 90vw)",
            }}
          >
            프롬프트가 복사되었습니다.
          </div>
        ) : null}
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
            <div style={{ position: "relative" }}>
              {generatedLabel ? (
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>마지막 생성: {generatedLabel}</p>
              ) : null}
              {hasPrompt ? (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button
                    type="button"
                    disabled={!fullText.trim()}
                    aria-label="프롬프트 복사"
                    title="클립보드에 복사"
                    onClick={() => void onCopyPrompt()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#334155",
                      cursor: fullText.trim() ? "pointer" : "not-allowed",
                      opacity: fullText.trim() ? 1 : 0.45,
                    }}
                  >
                    <ClipboardIcon />
                  </button>
                </div>
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
            </div>
          ) : (
            <div style={docBlock}>
              <div style={labelSm}>대화 기록 (저장본 기준)</div>
              {!conversationMessages || conversationMessages.length === 0 ? (
                <div style={{ ...bodyLg, color: "#64748b" }}>표시할 메시지가 없습니다.</div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 14,
                      paddingBottom: 12,
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <button type="button" onClick={toggleSelectAll} style={actionBarBtn}>
                      {allSelected ? "전체 해제" : "전체 선택"}
                    </button>
                    <button type="button" disabled={selectedIds.size === 0} onClick={onSaveSelected} style={{ ...actionBarBtn, opacity: selectedIds.size === 0 ? 0.5 : 1 }}>
                      선택 저장
                    </button>
                    <button type="button" disabled={!orderedMessages.length} onClick={onSaveAll} style={{ ...actionBarBtn, opacity: !orderedMessages.length ? 0.5 : 1 }}>
                      전체 저장
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {conversationMessages.map((m) => (
                      <label
                        key={m.id}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          cursor: "pointer",
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                          background: m.role === "user" ? "#f8fafc" : m.role === "ai" ? "#fff" : "#fefce8",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(m.id)}
                          onChange={(e) => toggleOne(m.id, e.target.checked)}
                          style={{ marginTop: 4, width: 18, height: 18, flexShrink: 0, accentColor: "#0d7377" }}
                        />
                        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>
                            {formatSpeaker(m)} · {m.createdAt ? new Date(m.createdAt).toLocaleString("ko-KR", { timeStyle: "short" }) : ""}
                          </div>
                          <div style={bodyLg}>{m.content}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
