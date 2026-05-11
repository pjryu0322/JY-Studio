"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import { uiTokens as t } from "@/components/ui/tokens";
import { writeClipboardText } from "@/lib/clipboard/writeClipboardText";
import type { PromptTimelineChannel, PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";
import {
  buildDebugPromptTimelineMarkdown,
  downloadDebugPromptTimelineMarkdown,
  localDateSlug,
  sanitizeTimelineExportBasename,
} from "@/lib/debug/promptTimelineMarkdown";
import { resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";

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

export function PromptTimelinePageClient() {
  const isNarrow = useMediaQuery("(max-width: 720px)");
  const pathname = usePathname() || "/";
  const pathOnly = (pathname.split("?")[0] || "/").trim() || "/";
  const searchParams = useSearchParams();
  /** `/prompt-timeline`는 `?projectId=`만 보고, 그 외 경로는 워크플로 컨텍스트를 쓴다. */
  const activeProjectId = useMemo(() => {
    if (pathOnly === "/prompt-timeline" || pathOnly.startsWith("/prompt-timeline/")) {
      return String(searchParams.get("projectId") ?? "").trim();
    }
    return resolveWorkflowProjectContextId(pathname, searchParams)?.trim() ?? "";
  }, [pathOnly, pathname, searchParams]);

  const scopeLabel = activeProjectId ? `프로젝트 · ${activeProjectId}` : "내 계정(메신저 등)";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<PromptTimelineEntry[]>([]);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const id = activeProjectId.trim();
    setLoading(true);
    setError(null);
    try {
      const url = id
        ? `/api/projects/${encodeURIComponent(id)}/debug/prompt-timeline`
        : `/api/me/debug/prompt-timeline`;
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
  }, [activeProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    const stem = activeProjectId.trim() ? sanitizeTimelineExportBasename(activeProjectId) : "prompt-timeline-me";
    const md = buildDebugPromptTimelineMarkdown(entries);
    downloadDebugPromptTimelineMarkdown(`${stem}-prompt-timeline-${localDateSlug()}.md`, md);
  }, [entries, activeProjectId]);

  return (
    <div style={{ minHeight: "70vh", padding: isNarrow ? "12px 12px 28px" : "18px 16px 44px", position: "relative" }}>
      {copyToast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 80,
            padding: "8px 14px",
            borderRadius: 10,
            background: "#0f172a",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",
            maxWidth: "min(360px, 92vw)",
            textAlign: "center",
          }}
        >
          {copyToast}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary }}>프롬프트 타임라인</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginTop: 4 }}>{scopeLabel}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              padding: "6px 12px",
              cursor: loading ? "wait" : "pointer",
              color: t.textSecondary,
            }}
          >
            새로고침
          </button>
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
              padding: "6px 12px",
              cursor: entries.length ? "pointer" : "not-allowed",
              color: t.textSecondary,
              opacity: entries.length ? 1 : 0.55,
            }}
          >
            MD 저장
          </button>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textMuted }}>불러오는 중…</div>
      ) : error ? (
        <div style={{ fontSize: 13, color: "#b91c1c" }}>{error}</div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
          아직 기록된 호출이 없습니다. OpenAI를 쓰는 작업을 하거나 Cursor 에이전트를 시작하면 여기에 쌓입니다.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxHeight: "calc(100dvh - 140px)",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            paddingRight: 4,
          }}
        >
          {entries.map((e) => (
            <li
              key={e.id}
              style={{
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: "12px 12px",
                background: t.bgCard,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, rowGap: 6, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: e.channel === "openai" ? "rgba(59,130,246,0.12)" : "rgba(100,116,139,0.15)",
                    color: t.textSecondary,
                  }}
                >
                  {channelLabel(e.channel)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 900, color: t.textSecondary }}>{e.label}</span>
                {e.purpose ? <span style={{ fontSize: 10, fontWeight: 900, color: t.textMuted, letterSpacing: "0.02em" }}>{e.purpose}</span> : null}
                {e.status ? (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      padding: "2px 6px",
                      borderRadius: 6,
                      background: e.status === "SUCCESS" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: e.status === "SUCCESS" ? "#166534" : "#991b1b",
                    }}
                  >
                    {e.status}
                  </span>
                ) : null}
                {e.model ? <span style={{ fontSize: 11, color: t.textMuted }}>{e.model}</span> : null}
                <span style={{ fontSize: 11, color: t.textMuted, marginLeft: "auto" }}>{e.at}</span>
              </div>

              <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>플랫폼 → {channelLabel(e.channel)}</div>
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
                    maxHeight: "min(42dvh, 320px)",
                    overflow: "auto",
                    WebkitOverflowScrolling: "touch",
                    background: "#fff",
                    borderRadius: 10,
                    padding: 10,
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

              <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>{channelLabel(e.channel)} → 플랫폼</div>
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
                    maxHeight: "min(42dvh, 320px)",
                    overflow: "auto",
                    WebkitOverflowScrolling: "touch",
                    background: "#fff",
                    borderRadius: 10,
                    padding: 10,
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
  );
}

