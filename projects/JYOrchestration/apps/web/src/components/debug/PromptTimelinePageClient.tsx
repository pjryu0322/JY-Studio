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
import { HarnessApplyReadinessSummaryCard, OverlaySummaryCard } from "@/components/orchestration/overlay";
import { buildOverlayUiViewModel } from "@/lib/overlay-ui/overlayUiAdapter";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { evaluateHarnessPromptApplyReadiness } from "@/lib/harness/promptAssembly/evaluateHarnessPromptApplyReadiness";

type ApiOk = { success: true; data: { entries: PromptTimelineEntry[] } };
type ApiErr = { success: false; message?: string };

function channelLabel(ch: PromptTimelineChannel): string {
  return ch === "openai" ? "OpenAI" : "Cursor";
}

type EntryTabKey = "prompt" | "response" | "overlay" | "diagnostic";
type EntryDirection = "outbound" | "inbound";

const ENTRY_TAB_KEYS: readonly EntryTabKey[] = ["prompt", "response", "overlay", "diagnostic"];

const TAB_LABEL: Readonly<Record<EntryTabKey, string>> = {
  prompt: "프롬프트",
  response: "응답",
  overlay: "Overlay",
  diagnostic: "진단",
};

const TAB_ACCENT_COLOR = "#1d4ed8";
const TAB_ACCENT_BG = "rgba(59,130,246,0.10)";

function tabButtonStyle(active: boolean, narrow: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? TAB_ACCENT_COLOR : t.border}`,
    background: active ? TAB_ACCENT_BG : "#fff",
    color: active ? TAB_ACCENT_COLOR : t.textSecondary,
    borderRadius: 999,
    fontSize: narrow ? 11 : 12,
    fontWeight: 800,
    padding: narrow ? "4px 10px" : "5px 12px",
    cursor: "pointer",
  };
}

type PromptDirectionMeta = Readonly<{
  textKey: "outbound" | "inbound";
  ariaLabel: string;
  labelLeft: (channel: PromptTimelineChannel) => string;
}>;

const DIRECTION_META: Readonly<Record<EntryDirection, PromptDirectionMeta>> = {
  outbound: {
    textKey: "outbound",
    ariaLabel: "플랫폼→모델 프롬프트 복사",
    labelLeft: (ch) => `플랫폼 → ${channelLabel(ch)}`,
  },
  inbound: {
    textKey: "inbound",
    ariaLabel: "모델→플랫폼 응답 복사",
    labelLeft: (ch) => `${channelLabel(ch)} → 플랫폼`,
  },
};

type DiagnosticRow = Readonly<{ label: string; value: string }>;

function buildDiagnosticRows(entry: PromptTimelineEntry): readonly DiagnosticRow[] {
  const m = entry.promptMetrics ?? null;
  const rows: DiagnosticRow[] = [
    { label: "ID", value: entry.id },
    { label: "발생 시각", value: entry.at },
    { label: "채널", value: channelLabel(entry.channel) },
    { label: "라벨", value: entry.label },
    { label: "모델", value: entry.model ?? "—" },
    { label: "목적", value: entry.purpose ?? "—" },
    { label: "상태", value: entry.status ?? "—" },
  ];
  if (entry.errorMessage) rows.push({ label: "오류 메시지", value: entry.errorMessage });
  if (entry.parsedJsonPreview) rows.push({ label: "응답 JSON 미리보기", value: entry.parsedJsonPreview });
  if (m?.tokenEstimateIn != null) rows.push({ label: "입력 토큰 추정", value: String(m.tokenEstimateIn) });
  if (m?.tokenEstimateOut != null) rows.push({ label: "출력 토큰 추정", value: String(m.tokenEstimateOut) });
  if (m?.compressedContextSize != null) rows.push({ label: "압축 컨텍스트", value: String(m.compressedContextSize) });
  if (m?.topic) rows.push({ label: "주제", value: m.topic });
  return rows;
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
  /**
   * Overlay 탭은 기본 닫힘. 모바일 UX 보호 및 기존 dual-pane UX를 그대로 두기 위해
   * 이 toggle이 OFF면 legacy 레이아웃(outbound + inbound)을 그대로 노출한다.
   */
  const [showOverlayTabs, setShowOverlayTabs] = useState(false);

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

  /**
   * Harness Phase H2 — 클라이언트 사이드 readiness 평가.
   * 이미 가지고 있는 timeline entries(각 `entry.overlay`)로 evaluator를 호출한다.
   * **read-only / 진단 metadata only.** 실제 적용 행위는 없다.
   *
   * `showOverlayTabs`가 ON일 때만 노출되어 기존 dual-pane UX를 깨지 않도록 한다.
   */
  const harnessReadinessReport = useMemo(
    () =>
      evaluateHarnessPromptApplyReadiness({
        entries: entries.map((e) => ({
          harnessPromptAssemblyPreview: e.overlay?.harnessPromptAssemblyPreview ?? null,
          harnessPromptPreviewDiff: e.overlay?.harnessPromptPreviewDiff ?? null,
        })),
      }),
    [entries]
  );

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
          <OverlayVisibilityToggle
            active={showOverlayTabs}
            onToggle={() => setShowOverlayTabs((v) => !v)}
          />
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

      {showOverlayTabs && entries.length > 0 ? (
        <HarnessApplyReadinessSummaryCard report={harnessReadinessReport} />
      ) : null}

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
            <PromptTimelineEntryCard
              key={e.id}
              entry={e}
              isNarrow={isNarrow}
              showOverlayTabs={showOverlayTabs}
              onCopyText={copyText}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PromptTimelineEntryHeader({ entry }: { readonly entry: PromptTimelineEntry }) {
  const overlayVm = useMemo(() => buildOverlayUiViewModel(entry.overlay ?? undefined), [entry.overlay]);
  const showOverlayBadge = overlayVm.hasOverlayData;
  const channelVariant: BadgeVariant = entry.channel === "openai" ? "info" : "neutral";
  const statusVariant: BadgeVariant | null = entry.status
    ? entry.status === "SUCCESS"
      ? "success"
      : "danger"
    : null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, rowGap: 6, marginBottom: 8 }}>
      <Badge variant={channelVariant}>{channelLabel(entry.channel)}</Badge>
      <span style={{ fontSize: 12, fontWeight: 900, color: t.textSecondary }}>{entry.label}</span>
      {entry.purpose ? <span style={{ fontSize: 10, fontWeight: 900, color: t.textMuted, letterSpacing: "0.02em" }}>{entry.purpose}</span> : null}
      {statusVariant && entry.status ? <Badge variant={statusVariant}>{entry.status}</Badge> : null}
      {entry.model ? <span style={{ fontSize: 11, color: t.textMuted }}>{entry.model}</span> : null}
      {showOverlayBadge ? (
        <Badge variant="info" title="이 시점에 Overlay Runtime 정보가 기록되어 있습니다.">
          Overlay
        </Badge>
      ) : null}
      <span style={{ fontSize: 11, color: t.textMuted, marginLeft: "auto" }}>{entry.at}</span>
    </div>
  );
}

function PromptCopyPane({
  text,
  ariaLabel,
  isNarrow,
  onCopy,
}: {
  readonly text: string;
  readonly ariaLabel: string;
  readonly isNarrow: boolean;
  readonly onCopy: (text: string) => Promise<void> | void;
}) {
  const value = String(text ?? "");
  return (
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
        {value}
      </pre>
      <button
        type="button"
        aria-label={ariaLabel}
        title="이 블록 복사"
        disabled={!value.length}
        onClick={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          void onCopy(value);
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
          cursor: value.length ? "pointer" : "not-allowed",
          opacity: value.length ? 1 : 0.45,
        }}
      >
        <ClipboardGlyph />
      </button>
    </div>
  );
}

function OverlayVisibilityToggle({
  active,
  onToggle,
}: {
  readonly active: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title="Overlay/진단 탭을 보기"
      style={{
        border: `1px solid ${active ? TAB_ACCENT_COLOR : t.border}`,
        background: active ? TAB_ACCENT_BG : "#fff",
        color: active ? TAB_ACCENT_COLOR : t.textSecondary,
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        padding: "6px 12px",
        cursor: "pointer",
      }}
    >
      {active ? "Overlay 숨기기" : "Overlay 보기"}
    </button>
  );
}

function PromptDirectionPane({
  entry,
  direction,
  isNarrow,
  onCopy,
}: {
  readonly entry: PromptTimelineEntry;
  readonly direction: EntryDirection;
  readonly isNarrow: boolean;
  readonly onCopy: (text: string) => Promise<void> | void;
}) {
  const meta = DIRECTION_META[direction];
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, marginBottom: 4 }}>
        {meta.labelLeft(entry.channel)}
      </div>
      <PromptCopyPane
        text={entry[meta.textKey]}
        ariaLabel={meta.ariaLabel}
        isNarrow={isNarrow}
        onCopy={onCopy}
      />
    </>
  );
}

function PromptTimelineDiagnosticPane({ entry }: { readonly entry: PromptTimelineEntry }) {
  const rows = buildDiagnosticRows(entry);
  return (
    <div
      style={{
        background: "#f8fafc",
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {rows.map((r, i) => (
        <div
          key={`diag-${i}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            fontSize: 12,
            color: t.textSecondary,
            padding: "3px 0",
          }}
        >
          <span style={{ fontWeight: 700, color: t.textMuted }}>{r.label}</span>
          <span style={{ wordBreak: "break-all", textAlign: "right" }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function EntryTabStrip({
  activeTab,
  onChange,
  isNarrow,
}: {
  readonly activeTab: EntryTabKey;
  readonly onChange: (next: EntryTabKey) => void;
  readonly isNarrow: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="프롬프트 타임라인 탭"
      style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}
    >
      {ENTRY_TAB_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={activeTab === k}
          onClick={() => onChange(k)}
          style={tabButtonStyle(activeTab === k, isNarrow)}
        >
          {TAB_LABEL[k]}
        </button>
      ))}
    </div>
  );
}

function PromptTimelineEntryCard({
  entry,
  isNarrow,
  showOverlayTabs,
  onCopyText,
}: {
  readonly entry: PromptTimelineEntry;
  readonly isNarrow: boolean;
  readonly showOverlayTabs: boolean;
  readonly onCopyText: (text: string) => Promise<void> | void;
}) {
  const [tab, setTab] = useState<EntryTabKey>("prompt");
  const directions: readonly EntryDirection[] = ["outbound", "inbound"];
  return (
    <li
      style={{
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: "12px 12px",
        background: t.bgCard,
        flexShrink: 0,
      }}
    >
      <PromptTimelineEntryHeader entry={entry} />

      {!showOverlayTabs ? (
        directions.map((dir, i) => (
          <div key={dir} style={{ marginBottom: i === 0 ? 10 : 0 }}>
            <PromptDirectionPane entry={entry} direction={dir} isNarrow={isNarrow} onCopy={onCopyText} />
          </div>
        ))
      ) : (
        <>
          <EntryTabStrip activeTab={tab} onChange={setTab} isNarrow={isNarrow} />
          {tab === "prompt" ? (
            <PromptDirectionPane entry={entry} direction="outbound" isNarrow={isNarrow} onCopy={onCopyText} />
          ) : null}
          {tab === "response" ? (
            <PromptDirectionPane entry={entry} direction="inbound" isNarrow={isNarrow} onCopy={onCopyText} />
          ) : null}
          {tab === "overlay" ? <OverlaySummaryCard overlay={entry.overlay ?? null} /> : null}
          {tab === "diagnostic" ? <PromptTimelineDiagnosticPane entry={entry} /> : null}
        </>
      )}
    </li>
  );
}

