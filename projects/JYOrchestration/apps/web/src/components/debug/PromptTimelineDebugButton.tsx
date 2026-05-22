"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PromptTimelineDocIcon } from "@/components/debug/PromptTimelineDocIcon";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import { uiTokens as t } from "@/components/ui/tokens";
import { writeClipboardText } from "@/lib/clipboard/writeClipboardText";
import {
  resolvePromptTimelineExportStem,
  resolvePromptTimelineFetchUrl,
} from "@/lib/debug/promptTimelineApiPaths";
import type { PromptTimelineChannel, PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";
import {
  buildDebugPromptTimelineMarkdown,
  downloadDebugPromptTimelineMarkdown,
  localDateSlug,
  sanitizeTimelineExportBasename,
} from "@/lib/debug/promptTimelineMarkdown";

type ApiOk = { success: true; data: { entries: PromptTimelineEntry[] } };
type ApiErr = { success: false; message?: string };

function channelLabel(ch: PromptTimelineChannel): string {
  return ch === "openai" ? "OpenAI" : "Cursor";
}

function ClipboardGlyph({ size = 16 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

const DEFAULT_EMPTY_HINT =
  "아직 기록된 호출이 없습니다. 기능 정리·초기화 등 OpenAI를 쓰는 작업을 하거나 Cursor 에이전트를 시작하면 여기에 쌓입니다.";

export function PromptTimelinePanelButton(p: {
  readonly projectId?: string | null;
  readonly roomId?: string | null;
  readonly disabled?: boolean;
  readonly emptyHint?: string;
}) {
  const timelineFetchUrl = resolvePromptTimelineFetchUrl(p);
  const exportStem = resolvePromptTimelineExportStem(p);
  const isNarrow = useMediaQuery("(max-width: 720px)");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<PromptTimelineEntry[]>([]);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const url = timelineFetchUrl;
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "GET", cache: "no-store" });
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
  }, [timelineFetchUrl]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const flashCopy = useCallback((message: string) => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopyToast(message);
    copyTimerRef.current = setTimeout(() => {
      setCopyToast(null);
      copyTimerRef.current = null;
    }, 1600);
  }, []);

  const copyText = useCallback(
    async (text: string) => {
      const raw = String(text ?? "");
      if (!raw.length) return;
      const ok = await writeClipboardText(raw);
      flashCopy(ok ? "클립보드에 복사했습니다." : "복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    },
    [flashCopy]
  );

  const onExportMarkdown = useCallback(() => {
    if (!entries.length) return;
    const stem = sanitizeTimelineExportBasename(exportStem);
    const md = buildDebugPromptTimelineMarkdown(entries);
    downloadDebugPromptTimelineMarkdown(`${stem}-prompt-timeline-${localDateSlug()}.md`, md);
  }, [entries, exportStem]);

  if (!timelineFetchUrl) return null;

  return (
    <>
      <button
        type="button"
        data-testid="prompt-timeline-open"
        aria-label="프롬프트 타임라인"
        title="프롬프트 타임라인 (디버그)"
        disabled={p.disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (p.disabled) return;
          setOpen(true);
        }}
        style={{
          position: "relative",
          border: "1px solid #e2e8f0",
          background: p.disabled ? "#f8fafc" : "#fff",
          borderRadius: 10,
          width: 36,
          height: 36,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: p.disabled ? t.textMuted : "#0f172a",
          cursor: p.disabled ? "not-allowed" : "pointer",
          opacity: p.disabled ? 0.55 : 1,
          flexShrink: 0,
        }}
      >
        <PromptTimelineDocIcon size={18} />
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
            style={
              isNarrow
                ? {
                    position: "fixed",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    top: "auto",
                    zIndex: 75,
                    width: "100%",
                    maxWidth: "100%",
                    height: "min(88dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 48px))",
                    maxHeight: "min(88dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 48px))",
                    minHeight: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "16px 16px 0 0",
                    border: `1px solid ${t.border}`,
                    borderBottom: "none",
                    background: t.bgCard,
                    boxShadow: "0 -8px 40px rgba(15, 23, 42, 0.12)",
                    paddingBottom: "env(safe-area-inset-bottom, 0px)",
                  }
                : {
                    position: "fixed",
                    right: 12,
                    top: 56,
                    zIndex: 75,
                    width: "min(560px, calc(100vw - 24px))",
                    height: "min(82dvh, 680px)",
                    maxHeight: "min(82dvh, 680px)",
                    minHeight: 0,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 12,
                    border: `1px solid ${t.border}`,
                    background: t.bgCard,
                    boxShadow: "0 12px 40px rgba(15, 23, 42, 0.14)",
                  }
            }
          >
            {copyToast ? (
              <div
                role="status"
                aria-live="polite"
                style={{
                  position: "fixed",
                  bottom: isNarrow ? "calc(88dvh + 12px)" : 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 76,
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "#0f172a",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "center",
                  maxWidth: "min(360px, 92vw)",
                  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",
                }}
              >
                {copyToast}
              </div>
            ) : null}
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={onExportMarkdown}
                  disabled={!entries.length}
                  style={{
                    border: `1px solid ${t.border}`,
                    background: entries.length ? "#ecfdf5" : "#f1f5f9",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    cursor: entries.length ? "pointer" : "not-allowed",
                    color: t.textSecondary,
                    opacity: entries.length ? 1 : 0.55,
                  }}
                >
                  MD 저장
                </button>
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
            <div
              style={{
                position: "relative",
                padding: isNarrow ? "10px 12px 12px" : 12,
                overflowY: "auto",
                flex: "1 1 0%",
                WebkitOverflowScrolling: "touch",
                minHeight: 0,
              }}
            >
              {loading && entries.length === 0 ? (
                <div style={{ fontSize: 13, color: t.textMuted }}>불러오는 중…</div>
              ) : error ? (
                <div style={{ fontSize: 13, color: "#b91c1c" }}>{error}</div>
              ) : entries.length === 0 ? (
                <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>{p.emptyHint ?? DEFAULT_EMPTY_HINT}</div>
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
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "baseline",
                          gap: 8,
                          rowGap: 6,
                          marginBottom: 6,
                          columnGap: 8,
                        }}
                      >
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
                        <span
                          style={{
                            fontSize: 11,
                            color: t.textMuted,
                            marginLeft: isNarrow ? 0 : "auto",
                            width: isNarrow ? "100%" : undefined,
                            flexBasis: isNarrow ? "100%" : undefined,
                          }}
                        >
                          {e.at}
                        </span>
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
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
                        <pre
                          style={{
                            margin: 0,
                            flex: "1 1 0%",
                            minWidth: 0,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: isNarrow ? 10.5 : 11,
                            lineHeight: 1.45,
                            color: t.textSecondary,
                            maxHeight: isNarrow ? "min(36dvh, 220px)" : "min(40dvh, 280px)",
                            overflow: "auto",
                            WebkitOverflowScrolling: "touch",
                            background: "#fff",
                            borderRadius: 8,
                            padding: 8,
                            border: `1px solid ${t.border}`,
                          }}
                        >
                          {e.outbound}
                        </pre>
                        <button
                          type="button"
                          aria-label="플랫폼→모델 프롬프트 복사"
                          title="이 블록 복사"
                          disabled={!String(e.outbound ?? "").length}
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            void copyText(e.outbound);
                          }}
                          style={{
                            flexShrink: 0,
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            border: `1px solid ${t.border}`,
                            background: "#fff",
                            color: t.textSecondary,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: String(e.outbound ?? "").length ? "pointer" : "not-allowed",
                            opacity: String(e.outbound ?? "").length ? 1 : 0.45,
                          }}
                        >
                          <ClipboardGlyph />
                        </button>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>{channelLabel(e.channel)} → 플랫폼</div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <pre
                          style={{
                            margin: 0,
                            flex: "1 1 0%",
                            minWidth: 0,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            fontSize: isNarrow ? 10.5 : 11,
                            lineHeight: 1.45,
                            color: t.textSecondary,
                            maxHeight: isNarrow ? "min(36dvh, 220px)" : "min(40dvh, 280px)",
                            overflow: "auto",
                            WebkitOverflowScrolling: "touch",
                            background: "#fff",
                            borderRadius: 8,
                            padding: 8,
                            border: `1px solid ${t.border}`,
                          }}
                        >
                          {e.inbound}
                        </pre>
                        <button
                          type="button"
                          aria-label="모델→플랫폼 응답 복사"
                          title="이 블록 복사"
                          disabled={!String(e.inbound ?? "").length}
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            void copyText(e.inbound);
                          }}
                          style={{
                            flexShrink: 0,
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            border: `1px solid ${t.border}`,
                            background: "#fff",
                            color: t.textSecondary,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: String(e.inbound ?? "").length ? "pointer" : "not-allowed",
                            opacity: String(e.inbound ?? "").length ? 1 : 0.45,
                          }}
                        >
                          <ClipboardGlyph />
                        </button>
                      </div>
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

export function PromptTimelineDebugButton(p: { readonly projectId: string }) {
  const id = p.projectId.trim();
  if (!id) return null;
  return <PromptTimelinePanelButton projectId={id} />;
}
