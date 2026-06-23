"use client";

import { ConversationChromeToolbar } from "@/components/workspace/ConversationChromeToolbar";
import { WorkspaceHubChromeIconButton, WorkspaceHubUsersIcon } from "@/components/workspace/WorkspaceHubChromeIconButton";
import type { OrchestrationSlotSummarySection } from "@/lib/requirements/singleChatOrchestrationSlots";
import { QUICK_DESIGN_ACCESSIBLE_LABEL } from "@/lib/requirements/quickDesignLabels";
import {
  SERVICE_DEFINITION_DETAIL_ARIA_LABEL,
  SERVICE_DEFINITION_PROGRESS_LABEL,
} from "@/lib/requirements/servicePlanningUserLabels";
import { useEffect, useMemo, useRef, useState } from "react";

export type WorkspaceConversationInterviewUi = Readonly<{
  readonly readinessPercent: number;
  readonly covered: number;
  readonly total: number;
  readonly statusCounts?: Readonly<{
    confirmed: number;
    partial: number;
    candidate: number;
    stale: number;
    empty: number;
  }> | null;
  readonly remainingQuestionsEstimate: number;
  readonly orchestrationSlotSections?: readonly OrchestrationSlotSummarySection[] | null;
  /** 슬롯 그리드 셀 라벨 → 보조 설명(구현 슬롯 값 요약 등) */
  readonly slotCellHints?: Readonly<Record<string, string>> | null;
  readonly onForceGeneratePlanNow: () => void;
  /** 슬롯 확정(기본) vs 작업 완료(구현 실행 보드) */
  readonly progressCountKind?: "slots" | "tasks";
}>;

export type WorkspaceSlotsChromeLabels = Readonly<{
  readonly progressLabel: string;
  readonly detailAriaLabel: string;
}>;

export type WorkspaceConversationHubIconRowProps = Readonly<{
  readonly busy?: boolean;
  readonly remoteLocked?: boolean;
  readonly interviewUi?: WorkspaceConversationInterviewUi | null;
  /** false면 슬롯 그리드 버튼·팝오버만 숨김(빠른 실행 등 interviewUi 기반 버튼은 유지) */
  readonly showSlotsChrome?: boolean;
  /** planning 기본값 대신 구현 단계 등 화면별 라벨 */
  readonly slotsChromeLabels?: WorkspaceSlotsChromeLabels | null;
  readonly quickExecutionTitle?: string;
  readonly quickExecutionAriaLabel?: string;
  /** CodeTask 1건 이상 선택 시 빠른 실행 아이콘 강조 */
  readonly quickExecutionEmphasized?: boolean;
  readonly memberControls?: { readonly count: number; readonly onOpen: () => void } | null;
  readonly canvasHubControls?: { readonly count: number; readonly onOpen: () => void } | null;
  readonly artifactHubControls?: {
    readonly count: number;
    readonly hasStale?: boolean;
    readonly onOpen: () => void;
    readonly title?: string;
  } | null;
  readonly onDownloadConversationMarkdown?: () => void | Promise<void>;
  readonly onResetConversation?: () => void | Promise<void>;
  readonly onSummarizeConversation?: () => void | Promise<void>;
  readonly resetConversationDisabled?: boolean;
  readonly downloadDisabled?: boolean;
  readonly onOpenEnvironmentSettings?: () => void;
  /** 모바일: primary 5개 + 더보기 메뉴 */
  readonly iconLayout?: "full" | "mobileCompact";
  readonly overflowMenuItems?: readonly Readonly<{
    readonly id: string;
    readonly label: string;
    readonly onClick: () => void;
    readonly disabled?: boolean;
  }>[];
}>;

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 13l.8 2.4L22 16l-2.2.6L19 19l-.8-2.4L16 16l2.2-.6L19 13z" />
    </svg>
  );
}

function QuickDesignIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function SlotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function CanvasHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

function ArtifactHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

const SLOTS_PANEL_SIZE_STORAGE_KEY = "jyo:requirements-slots-popover-size";
const SLOTS_PANEL_MIN_W = 360;
const SLOTS_PANEL_MIN_H = 280;
const SLOTS_PANEL_DEFAULT_W = 520;
const SLOTS_PANEL_DEFAULT_H = 520;

function readStoredSlotsPanelSize(): { readonly w: number; readonly h: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SLOTS_PANEL_SIZE_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { w?: unknown; h?: unknown };
    const w = Number(p.w);
    const h = Number(p.h);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
    const margin = 24;
    return {
      w: Math.min(Math.max(SLOTS_PANEL_MIN_W, Math.round(w)), window.innerWidth - margin),
      h: Math.min(Math.max(SLOTS_PANEL_MIN_H, Math.round(h)), window.innerHeight - margin),
    };
  } catch {
    return null;
  }
}

function writeStoredSlotsPanelSize(w: number, h: number): void {
  try {
    window.sessionStorage.setItem(
      SLOTS_PANEL_SIZE_STORAGE_KEY,
      JSON.stringify({ w: Math.round(w), h: Math.round(h) }),
    );
  } catch {
    /* ignore */
  }
}

function defaultSlotsPanelSize(maxH: number): { readonly w: number; readonly h: number } {
  const margin = 24;
  const w = Math.min(SLOTS_PANEL_DEFAULT_W, window.innerWidth - margin);
  const h = Math.min(Math.max(SLOTS_PANEL_MIN_H, maxH, SLOTS_PANEL_DEFAULT_H), window.innerHeight - margin);
  return { w, h };
}

export function WorkspaceConversationHubIconRow({
  busy = false,
  remoteLocked = false,
  interviewUi,
  showSlotsChrome = true,
  quickExecutionTitle,
  quickExecutionAriaLabel,
  quickExecutionEmphasized = false,
  memberControls,
  canvasHubControls,
  artifactHubControls,
  onDownloadConversationMarkdown,
  onResetConversation,
  onSummarizeConversation,
  resetConversationDisabled = false,
  downloadDisabled = false,
  onOpenEnvironmentSettings,
  slotsChromeLabels = null,
  iconLayout = "full",
  overflowMenuItems = [],
}: WorkspaceConversationHubIconRowProps) {
  const slotsUi = interviewUi ?? null;
  const progressLabel = slotsChromeLabels?.progressLabel ?? SERVICE_DEFINITION_PROGRESS_LABEL;
  const progressCountLabel = slotsUi?.progressCountKind === "tasks" ? "완료" : "확정";
  const detailAriaLabel = slotsChromeLabels?.detailAriaLabel ?? SERVICE_DEFINITION_DETAIL_ARIA_LABEL;
  const quickTitle = quickExecutionTitle ?? QUICK_DESIGN_ACCESSIBLE_LABEL;
  const quickAria = quickExecutionAriaLabel ?? quickTitle;

  const [slotsOpen, setSlotsOpen] = useState(false);
  const slotsBtnRef = useRef<HTMLButtonElement | null>(null);
  const slotsPanelRef = useRef<HTMLDivElement | null>(null);
  const [slotsPos, setSlotsPos] = useState<{ top: number; right: number; maxH: number; narrow: boolean } | null>(null);
  const [slotsPanelSize, setSlotsPanelSize] = useState<{ w: number; h: number } | null>(null);
  const useOrchestrationGrid = Boolean(slotsUi?.orchestrationSlotSections?.some((s) => s.slots.length));

  const computeSlotsPos = () => {
    const btn = slotsBtnRef.current;
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const margin = 12;
    const top = Math.min(window.innerHeight - margin, r.bottom + 8);
    const right = Math.max(margin, window.innerWidth - r.right);
    const narrow = window.innerWidth < 820;
    const maxH = narrow
      ? Math.max(220, Math.floor((window.innerHeight - 20) * 0.5))
      : Math.max(220, Math.floor((window.innerHeight - top - margin) * 0.5));
    return { top, right, maxH, narrow };
  };

  useEffect(() => {
    if (!slotsOpen) return;
    const pos = computeSlotsPos();
    if (pos) setSlotsPos(pos);
    if (pos && !pos.narrow) {
      const stored = readStoredSlotsPanelSize();
      setSlotsPanelSize(stored ?? defaultSlotsPanelSize(pos.maxH));
    } else {
      setSlotsPanelSize(null);
    }
  }, [slotsOpen]);

  useEffect(() => {
    if (!slotsOpen || slotsPos?.narrow) return;
    const el = slotsPanelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w < SLOTS_PANEL_MIN_W || h < SLOTS_PANEL_MIN_H) return;
      writeStoredSlotsPanelSize(w, h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [slotsOpen, slotsPos?.narrow]);

  useEffect(() => {
    if (!slotsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setSlotsOpen(false);
    };
    const onResize = () => {
      const pos = computeSlotsPos();
      if (pos) setSlotsPos(pos);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (slotsBtnRef.current?.contains(t)) return;
      const panel = document.getElementById("requirements-slots-popover");
      if (panel && panel.contains(t)) return;
      setSlotsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [slotsOpen]);

  const slotPanel = useMemo(() => {
    if (!showSlotsChrome || !slotsOpen || !slotsUi) return null;
    const pos = slotsPos ?? computeSlotsPos();
    if (!pos) return null;
    const sections = slotsUi.orchestrationSlotSections ?? [];
    const gridCols = pos.narrow ? 1 : 2;
    const panelW = pos.narrow ? "min(96vw, 420px)" : slotsPanelSize?.w ?? SLOTS_PANEL_DEFAULT_W;
    const panelH = pos.narrow ? pos.maxH : slotsPanelSize?.h ?? pos.maxH;
    const maxPanelW = Math.max(SLOTS_PANEL_MIN_W, window.innerWidth - 24);
    const maxPanelH = Math.max(SLOTS_PANEL_MIN_H, window.innerHeight - 24);
    return (
      <>
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1090,
            background: "rgba(15, 23, 42, 0.35)",
            backdropFilter: "blur(2px)",
          }}
        />
        <div
          ref={slotsPanelRef}
          id="requirements-slots-popover"
          role="dialog"
          aria-label={SERVICE_DEFINITION_DETAIL_ARIA_LABEL}
          style={{
            position: "fixed",
            top: pos.narrow ? "max(10px, env(safe-area-inset-top, 0px))" : pos.top,
            right: pos.narrow ? "max(10px, env(safe-area-inset-right, 0px))" : pos.right,
            left: pos.narrow ? "max(10px, env(safe-area-inset-left, 0px))" : undefined,
            zIndex: 1100,
            width: pos.narrow ? "auto" : panelW,
            height: pos.narrow ? undefined : panelH,
            maxWidth: pos.narrow ? undefined : maxPanelW,
            maxHeight: pos.narrow ? pos.maxH : maxPanelH,
            minWidth: pos.narrow ? undefined : SLOTS_PANEL_MIN_W,
            minHeight: pos.narrow ? undefined : SLOTS_PANEL_MIN_H,
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            background: "#fff",
            boxShadow: "0 24px 64px -28px rgba(15, 23, 42, 0.35)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            ...(!pos.narrow ? { resize: "both" as const } : {}),
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid #f1f5f9",
              background: "#f8fafc",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>
                {progressLabel} {slotsUi.readinessPercent}%
                {slotsUi.statusCounts
                  ? ` · 확정 ${slotsUi.statusCounts.confirmed} / 부분 ${slotsUi.statusCounts.partial} / 후보 ${slotsUi.statusCounts.candidate}`
                  : ` · ${slotsUi.covered}/${slotsUi.total}`}
              </div>
              <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: "#0f766e",
                    width: `${Math.min(100, Math.max(0, slotsUi.readinessPercent))}%`,
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSlotsOpen(false)}
              aria-label="슬롯 상세 닫기"
              title="닫기"
              style={{
                flexShrink: 0,
                width: 30,
                height: 30,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#0f172a",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, overflow: "auto", flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
                {progressCountLabel} {slotsUi.covered} / 전체 {slotsUi.total}
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                예상 남은 질문: {Math.max(0, slotsUi.remainingQuestionsEstimate)}개
              </div>
            </div>
            {slotsUi.statusCounts ? (
              <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", display: "flex", flexWrap: "wrap", gap: 10 }}>
                <span>부분 {slotsUi.statusCounts.partial}</span>
                <span>· 후보 {slotsUi.statusCounts.candidate}</span>
                <span>· stale {slotsUi.statusCounts.stale}</span>
                <span>· 미확보 {slotsUi.statusCounts.empty}</span>
              </div>
            ) : null}
            {useOrchestrationGrid ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {sections.map((sec) =>
                  sec.slots.length ? (
                    <details key={sec.sectionTitle} open style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
                      <summary
                        style={{
                          listStyle: "none",
                          cursor: "pointer",
                          padding: "10px 12px",
                          fontSize: 12.5,
                          fontWeight: 900,
                          color: "#0f172a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sec.sectionTitle}
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 900, color: "#64748b" }}>{sec.slots.length}</span>
                      </summary>
                      <div style={{ padding: "0 12px 12px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`, gap: 8 }}>
                          {sec.slots.map((cell, idx) => {
                            const level = cell.level;
                            const icon = level === "filled" ? "✔" : level === "partial" ? "△" : "□";
                            const color = level === "filled" ? "#065f46" : level === "partial" ? "#92400e" : "#475569";
                            const bg = level === "filled" ? "#ecfdf5" : level === "partial" ? "#fffbeb" : "#f8fafc";
                            const border =
                              level === "filled" ? "1px solid #a7f3d0" : level === "partial" ? "1px solid #fde68a" : "1px solid #e2e8f0";
                            return (
                              <div
                                key={`${sec.sectionTitle}-${idx}-${cell.label}`}
                                style={{
                                  border,
                                  background: bg,
                                  borderRadius: 12,
                                  padding: "10px 10px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <span style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{cell.label}</span>
                                  {slotsUi.slotCellHints?.[cell.label] ? (
                                    <div
                                      style={{
                                        marginTop: 4,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "#64748b",
                                        lineHeight: 1.35,
                                        wordBreak: "break-word",
                                      }}
                                    >
                                      {slotsUi.slotCellHints[cell.label]}
                                    </div>
                                  ) : null}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 900, color, flexShrink: 0 }}>{icon}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  ) : null,
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, fontWeight: 900, color: "#64748b" }}>오케스트레이션 슬롯을 불러오는 중…</div>
            )}
          </div>
        </div>
      </>
    );
  }, [showSlotsChrome, slotsOpen, slotsUi, slotsPos, slotsPanelSize, useOrchestrationGrid, progressLabel, progressCountLabel]);

  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowBtnRef = useRef<HTMLButtonElement | null>(null);
  const overflowPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOverflowOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (overflowBtnRef.current?.contains(t)) return;
      if (overflowPanelRef.current?.contains(t)) return;
      setOverflowOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [overflowOpen]);

  const quickButton =
    slotsUi ? (
      <WorkspaceHubChromeIconButton
        title={quickTitle}
        ariaLabel={quickAria}
        disabled={remoteLocked}
        emphasisTone={quickExecutionEmphasized ? "amber" : "default"}
        onClick={() => {
          if (busy) {
            slotsUi.onForceGeneratePlanNow();
            return;
          }
          void slotsUi.onForceGeneratePlanNow();
        }}
      >
        <QuickDesignIcon />
      </WorkspaceHubChromeIconButton>
    ) : null;

  const slotsButton =
    showSlotsChrome && slotsUi ? (
      <WorkspaceHubChromeIconButton
        title={`${detailAriaLabel} · ${progressLabel} ${slotsUi.readinessPercent}%`}
        ariaLabel={`${detailAriaLabel}, ${progressLabel} ${slotsUi.readinessPercent}퍼센트`}
        disabled={false}
        badge={slotsUi.readinessPercent}
        buttonRef={(n) => {
          slotsBtnRef.current = n;
        }}
        onClick={() => setSlotsOpen((v) => !v)}
      >
        <SlotsIcon />
      </WorkspaceHubChromeIconButton>
    ) : null;

  const canvasHubButton =
    canvasHubControls ? (
      <WorkspaceHubChromeIconButton
        title="Canvas Hub — 프로젝트 상태 Viewer"
        ariaLabel="Canvas Hub 열기"
        disabled={false}
        badge={canvasHubControls.count > 0 ? canvasHubControls.count : undefined}
        onClick={() => canvasHubControls.onOpen()}
      >
        <CanvasHubIcon />
      </WorkspaceHubChromeIconButton>
    ) : null;

  const artifactHubButton =
    artifactHubControls ? (
      <WorkspaceHubChromeIconButton
        title={
          artifactHubControls.title
            ? artifactHubControls.count > 0
              ? `${artifactHubControls.title} — ${artifactHubControls.count}건`
              : artifactHubControls.title
            : artifactHubControls.count > 0
              ? `Artifact Hub — 완성 산출물 ${artifactHubControls.count}건`
              : "Artifact Hub — 산출물 생성·조회"
        }
        ariaLabel={
          artifactHubControls.title
            ? artifactHubControls.count > 0
              ? `${artifactHubControls.title} 열기, ${artifactHubControls.count}건`
              : `${artifactHubControls.title} 열기`
            : artifactHubControls.count > 0
              ? `Artifact Hub 열기, 완성 산출물 ${artifactHubControls.count}건`
              : "Artifact Hub 열기"
        }
        disabled={false}
        badge={artifactHubControls.count > 0 ? artifactHubControls.count : undefined}
        badgeTone={artifactHubControls.hasStale ? "stale" : "default"}
        onClick={() => artifactHubControls.onOpen()}
      >
        <ArtifactHubIcon />
      </WorkspaceHubChromeIconButton>
    ) : null;

  const memberButton =
    memberControls ? (
      <WorkspaceHubChromeIconButton
        title="참여 멤버/AI 보기"
        ariaLabel="참여 멤버/AI 보기"
        disabled={false}
        badge={memberControls.count}
        onClick={() => memberControls.onOpen()}
      >
        <WorkspaceHubUsersIcon />
      </WorkspaceHubChromeIconButton>
    ) : null;

  const downloadButton =
    onDownloadConversationMarkdown ? (
      <WorkspaceHubChromeIconButton
        title="대화 내역 마크다운 다운로드"
        ariaLabel="대화 내역 마크다운 다운로드"
        disabled={downloadDisabled}
        onClick={() => void onDownloadConversationMarkdown()}
      >
        <DownloadIcon />
      </WorkspaceHubChromeIconButton>
    ) : null;

  const resetButton =
    onResetConversation ? (
      <WorkspaceHubChromeIconButton
        title="대화 초기화 (전체 초기화 후 새로고침)"
        ariaLabel="대화 초기화 — 기획·구현 파생 데이터 전체 초기화 후 새로고침"
        disabled={resetConversationDisabled}
        onClick={() => onResetConversation()}
      >
        <RefreshIcon />
      </WorkspaceHubChromeIconButton>
    ) : null;

  const summarizeButton =
    onSummarizeConversation ? (
      <WorkspaceHubChromeIconButton
        title="대화 내역 AI 요약"
        ariaLabel="대화 내역 AI 요약"
        disabled={busy || remoteLocked}
        onClick={() => onSummarizeConversation()}
      >
        <SparklesIcon />
      </WorkspaceHubChromeIconButton>
    ) : null;

  const settingsButton =
    onOpenEnvironmentSettings ? (
      <WorkspaceHubChromeIconButton
        title="환경설정"
        ariaLabel="환경설정 열기"
        disabled={remoteLocked}
        onClick={() => onOpenEnvironmentSettings()}
      >
        <SettingsIcon />
      </WorkspaceHubChromeIconButton>
    ) : null;

  const chromeToolbar =
    onResetConversation ? (
      <ConversationChromeToolbar
        onDownloadConversationMarkdown={() =>
          onDownloadConversationMarkdown ? void onDownloadConversationMarkdown() : undefined
        }
        onResetConversation={() => onResetConversation()}
        downloadDisabled={downloadDisabled || !onDownloadConversationMarkdown}
        resetDisabled={resetConversationDisabled}
      />
    ) : onDownloadConversationMarkdown ? (
      <ConversationChromeToolbar
        onDownloadConversationMarkdown={() => void onDownloadConversationMarkdown()}
        onResetConversation={() => undefined}
        downloadDisabled={downloadDisabled}
        resetDisabled
      />
    ) : null;

  const builtOverflowItems = useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      onClick: () => void;
      disabled?: boolean;
    }> = [];
    if (onOpenEnvironmentSettings) {
      items.push({
        id: "environment-settings",
        label: "환경설정",
        onClick: () => onOpenEnvironmentSettings(),
        disabled: remoteLocked,
      });
    }
    if (downloadButton) {
      items.push({
        id: "download",
        label: "대화 다운로드",
        onClick: () => void onDownloadConversationMarkdown?.(),
        disabled: downloadDisabled,
      });
    }
    if (summarizeButton) {
      items.push({
        id: "summarize",
        label: "AI 요약",
        onClick: () => onSummarizeConversation?.(),
        disabled: busy || remoteLocked,
      });
    }
    if (onResetConversation) {
      items.push({
        id: "reset-conversation",
        label: "전체 초기화",
        onClick: () => void onResetConversation(),
        disabled: resetConversationDisabled,
      });
    }
    if (artifactHubControls) {
      items.push({
        id: "artifact-hub",
        label: artifactHubControls.title ?? "산출물 Hub",
        onClick: () => artifactHubControls.onOpen(),
      });
    }
    if (canvasHubControls) {
      items.push({
        id: "canvas-hub",
        label: "Canvas Hub",
        onClick: () => canvasHubControls.onOpen(),
      });
    }
    for (const item of overflowMenuItems) {
      items.push(item);
    }
    return items;
  }, [
    downloadButton,
    summarizeButton,
    artifactHubControls,
    canvasHubControls,
    overflowMenuItems,
    onDownloadConversationMarkdown,
    downloadDisabled,
    onSummarizeConversation,
    onResetConversation,
    resetConversationDisabled,
    onOpenEnvironmentSettings,
    busy,
    remoteLocked,
  ]);

  const overflowMenu =
    overflowOpen && builtOverflowItems.length ? (
      <div
        ref={overflowPanelRef}
        role="menu"
        aria-label="추가 도구"
        style={{
          position: "fixed",
          top: (overflowBtnRef.current?.getBoundingClientRect().bottom ?? 0) + 6,
          right: Math.max(12, window.innerWidth - (overflowBtnRef.current?.getBoundingClientRect().right ?? 0)),
          zIndex: 1200,
          minWidth: 168,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "#fff",
          boxShadow: "0 16px 40px -20px rgba(15, 23, 42, 0.35)",
          padding: 6,
        }}
      >
        {builtOverflowItems.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              setOverflowOpen(false);
              item.onClick();
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              border: "none",
              borderRadius: 8,
              background: "transparent",
              fontSize: 13,
              fontWeight: 800,
              color: item.disabled ? "#94a3b8" : "#0f172a",
              cursor: item.disabled ? "not-allowed" : "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    ) : null;

  const hasAny =
    slotsUi ||
    memberControls ||
    canvasHubControls ||
    artifactHubControls ||
    onDownloadConversationMarkdown ||
    onResetConversation ||
    onSummarizeConversation ||
    onOpenEnvironmentSettings ||
    overflowMenuItems.length > 0;

  if (!hasAny) return null;

  const isMobileCompact = iconLayout === "mobileCompact";

  return (
    <div
      data-testid="workspace-conversation-hub-icon-row"
      data-icon-layout={iconLayout}
      style={{
        display: "inline-flex",
        alignItems: "center",
        flexWrap: isMobileCompact ? "nowrap" : "wrap",
        gap: 8,
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      {slotPanel}
      {isMobileCompact ? (
        <>
          {quickButton}
          {settingsButton}
          {slotsButton}
          {memberButton}
          {resetButton}
          {builtOverflowItems.length ? (
            <>
              <WorkspaceHubChromeIconButton
                title="더보기"
                ariaLabel="더보기 메뉴"
                disabled={false}
                buttonRef={(n) => {
                  overflowBtnRef.current = n;
                }}
                onClick={() => setOverflowOpen((v) => !v)}
              >
                <MoreIcon />
              </WorkspaceHubChromeIconButton>
              {overflowMenu}
            </>
          ) : null}
        </>
      ) : (
        <>
          {quickButton}
          {settingsButton}
          {slotsButton}
          {canvasHubButton}
          {artifactHubButton}
          {memberButton}
          {chromeToolbar}
          {summarizeButton}
        </>
      )}
    </div>
  );
}
