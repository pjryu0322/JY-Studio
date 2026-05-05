"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import { uiTokens as t } from "@/components/ui/tokens";
import type { PromptTimelineChannel, PromptTimelineEntry } from "@/lib/debug/promptTimelineTypes";
import { resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";

type ApiOk = { success: true; data: { entries: PromptTimelineEntry[] } };
type ApiErr = { success: false; message?: string };

function channelLabel(ch: PromptTimelineChannel): string {
  return ch === "openai" ? "OpenAI" : "Cursor";
}

export function PromptTimelinePageClient() {
  const isNarrow = useMediaQuery("(max-width: 720px)");
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const projectId = useMemo(() => resolveWorkflowProjectContextId(pathname, searchParams)?.trim() ?? "", [pathname, searchParams]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<PromptTimelineEntry[]>([]);

  const load = useCallback(async () => {
    const id = projectId.trim();
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
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ minHeight: "70vh", padding: isNarrow ? "12px 12px 28px" : "18px 16px 44px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary }}>프롬프트 타임라인</div>
      </div>

      {!projectId ? (
        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
          프로젝트가 선택되지 않았습니다. `?projectId=...` 가 포함된 화면에서 접근해 주세요.
        </div>
      ) : loading && entries.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textMuted }}>불러오는 중…</div>
      ) : error ? (
        <div style={{ fontSize: 13, color: "#b91c1c" }}>{error}</div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
          아직 기록된 호출이 없습니다. OpenAI를 쓰는 작업을 하거나 Cursor 에이전트를 시작하면 여기에 쌓입니다.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {entries.map((e) => (
            <li
              key={e.id}
              style={{
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: "12px 12px",
                background: t.bgCard,
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
              <pre
                style={{
                  margin: "0 0 10px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: isNarrow ? 10.5 : 11,
                  lineHeight: 1.45,
                  color: t.textSecondary,
                  maxHeight: isNarrow ? 200 : 240,
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

              <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>{channelLabel(e.channel)} → 플랫폼</div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: isNarrow ? 10.5 : 11,
                  lineHeight: 1.45,
                  color: t.textSecondary,
                  maxHeight: isNarrow ? 200 : 240,
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

