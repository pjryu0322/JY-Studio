"use client";

import { useCallback, useEffect, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { PromptTimelineChannel, PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";

type ApiOk = { success: true; data: { entries: PromptTimelineEntry[] } };
type ApiErr = { success: false; message?: string };

function channelLabel(ch: PromptTimelineChannel): string {
  return ch === "openai" ? "OpenAI" : "Cursor";
}

export function PromptTimelineDebugButton(p: { readonly projectId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<PromptTimelineEntry[]>([]);

  const load = useCallback(async () => {
    const id = p.projectId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}/debug/prompt-timeline`, { method: "GET", cache: "no-store" });
      const json = (await res.json()) as ApiOk | ApiErr;
      if (!res.ok || !json.success) {
        setError((json as ApiErr).message ?? `HTTP ${res.status}`);
        setEntries([]);
        return;
      }
      setEntries(json.data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [p.projectId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!p.projectId.trim()) return null;

  return (
    <>
      <button
        type="button"
        data-testid="prompt-timeline-open"
        aria-label="프롬프트 타임라인"
        title="프롬프트 타임라인 (디버그)"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={{
          position: "relative",
          border: "1px solid #cbd5e1",
          background: "#fff",
          borderRadius: 10,
          width: 36,
          height: 36,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#0f172a",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="프롬프트 타임라인 닫기"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 74,
              border: 0,
              padding: 0,
              margin: 0,
              background: t.overlayScrim,
              cursor: "pointer",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="프롬프트 타임라인"
            style={{
              position: "fixed",
              right: 12,
              top: 56,
              zIndex: 75,
              width: "min(520px, calc(100vw - 24px))",
              maxHeight: "min(72vh, 560px)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              borderRadius: 12,
              border: `1px solid ${t.border}`,
              background: t.bgCard,
              boxShadow: "0 12px 40px rgba(15, 23, 42, 0.14)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                borderBottom: `1px solid ${t.border}`,
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: t.textSecondary }}>프롬프트 타임라인</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  style={{
                    border: `1px solid ${t.border}`,
                    background: "#fff",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    cursor: loading ? "wait" : "pointer",
                    color: t.textSecondary,
                  }}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: t.textMuted,
                    fontWeight: 800,
                    cursor: "pointer",
                    padding: "4px 8px",
                    fontSize: 13,
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
            <div style={{ padding: 12, overflowY: "auto", flex: "1 1 auto" }}>
              {loading && entries.length === 0 ? (
                <div style={{ fontSize: 13, color: t.textMuted }}>불러오는 중…</div>
              ) : error ? (
                <div style={{ fontSize: 13, color: "#b91c1c" }}>{error}</div>
              ) : entries.length === 0 ? (
                <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>
                  아직 기록된 호출이 없습니다. 기능 정리·초기화 등 OpenAI를 쓰는 작업을 하거나 Cursor 에이전트를 시작하면 여기에 쌓입니다.
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                  {entries.map((e) => (
                    <li
                      key={e.id}
                      style={{
                        border: `1px solid ${t.border}`,
                        borderRadius: 10,
                        padding: "10px 10px",
                        background: t.bgPage,
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: e.channel === "openai" ? "rgba(59,130,246,0.12)" : "rgba(100,116,139,0.15)",
                            color: t.textSecondary,
                          }}
                        >
                          {channelLabel(e.channel)}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: t.textSecondary }}>{e.label}</span>
                        {e.purpose ? (
                          <span style={{ fontSize: 10, fontWeight: 800, color: t.textMuted, letterSpacing: "0.02em" }}>{e.purpose}</span>
                        ) : null}
                        {e.status ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: 6,
                              background: e.status === "SUCCESS" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                              color: e.status === "SUCCESS" ? "#166534" : "#991b1b",
                            }}
                          >
                            {e.status}
                          </span>
                        ) : null}
                        {e.model ? (
                          <span style={{ fontSize: 11, color: t.textMuted }}>{e.model}</span>
                        ) : null}
                        <span style={{ fontSize: 11, color: t.textMuted, marginLeft: "auto" }}>{e.at}</span>
                      </div>
                      {e.promptMetrics ? (
                        <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 6, lineHeight: 1.4 }}>
                          추정 토큰 in≈{e.promptMetrics.tokenEstimateIn ?? "—"} out≈{e.promptMetrics.tokenEstimateOut ?? "—"} · 압축 맥락{" "}
                          {e.promptMetrics.compressedContextSize ?? "—"}자 · topic {e.promptMetrics.topic ?? "—"}
                          {e.promptMetrics.memoryStateSnapshot ? (
                            <>
                              <br />
                              memory {e.promptMetrics.memoryStateSnapshot}
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>플랫폼 → {channelLabel(e.channel)}</div>
                      <pre
                        style={{
                          margin: "0 0 10px",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 11,
                          lineHeight: 1.45,
                          color: t.textSecondary,
                          maxHeight: 200,
                          overflow: "auto",
                          background: "#fff",
                          borderRadius: 8,
                          padding: 8,
                          border: `1px solid ${t.border}`,
                        }}
                      >
                        {e.outbound}
                      </pre>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>{channelLabel(e.channel)} → 플랫폼</div>
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: 11,
                          lineHeight: 1.45,
                          color: t.textSecondary,
                          maxHeight: 200,
                          overflow: "auto",
                          background: "#fff",
                          borderRadius: 8,
                          padding: 8,
                          border: `1px solid ${t.border}`,
                        }}
                      >
                        {e.inbound}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
