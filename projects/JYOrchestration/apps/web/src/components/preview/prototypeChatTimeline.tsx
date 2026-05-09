"use client";

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComposerAtAtTargetPicker } from "@/components/composer/ComposerAtAtTargetPicker";
import { useComposerAtAtPicker } from "@/hooks/useComposerAtAtPicker";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";
import type { PrototypeWorkUnit } from "@/lib/prototype/prototypeRunTypes";
import type { PrototypeTemplateType } from "@/lib/templates/prototypeTemplates";
import { PROTOTYPE_TEMPLATES } from "@/lib/templates/prototypeTemplates";
import {
  PROTOTYPE_PLANNER_STAGE_LABELS_KO,
  type PrototypeChatAction,
  type PrototypeChatBlock,
  type PrototypeChatBuiltMessage,
} from "@/lib/prototype/buildPrototypeChatMessages";
import { WorkspaceAiMemberAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";

const userBubbleStandard: CSSProperties = {
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
  boxSizing: "border-box",
};

const chipBtn: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  color: "#0f172a",
};

const chipPrimary: CSSProperties = {
  ...chipBtn,
  border: "1px solid #0f766e",
  background: "#0f766e",
  color: "#fff",
};

const chipMuted: CSSProperties = {
  ...chipBtn,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
};

function toneColor(tone: string): string {
  if (tone === "done") return "#16a34a";
  if (tone === "running") return "#2563eb";
  if (tone === "failed") return "#dc2626";
  if (tone === "warn") return "#ea580c";
  return "#94a3b8";
}

export function PrototypeActionChips(p: {
  readonly actions: readonly PrototypeChatAction[];
  readonly onAction: (a: PrototypeChatAction) => void;
}) {
  if (!p.actions?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {p.actions.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={Boolean(a.disabled)}
          onClick={() => {
            if (a.disabled) return;
            p.onAction(a);
          }}
          style={
            a.intent === "CONFIRM_EXECUTION" ||
            a.intent === "CREATE_PLAN" ||
            a.intent === "START_WORK_PLAN_GENERATION" ||
            a.intent === "RETRY_PLANNER_GENERATION"
              ? { ...chipPrimary, opacity: a.disabled ? 0.5 : 1, cursor: a.disabled ? "not-allowed" : "pointer" }
              : { ...chipMuted, opacity: a.disabled ? 0.5 : 1, cursor: a.disabled ? "not-allowed" : "pointer" }
          }
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function renderBlocks(blocks: readonly PrototypeChatBlock[] | undefined): ReactNode {
  if (!blocks?.length) return null;
  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
      {blocks.map((b, i) => {
        if (b.kind === "text") {
          return (
            <div key={`t-${i}`} style={{ color: "#334155", fontWeight: 650, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.55 }}>
              {b.text}
            </div>
          );
        }
        if (b.kind === "env_table") {
          return (
            <div
              key={`e-${i}`}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                overflow: "hidden",
                fontSize: 12,
              }}
            >
              {b.rows.map((r) => (
                <div
                  key={r.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "8px 10px",
                    borderTop: r.key === b.rows[0]?.key ? undefined : "1px solid #f1f5f9",
                    background: "#fafbfc",
                  }}
                >
                  <span style={{ fontWeight: 800, color: "#475569" }}>{r.label}</span>
                  <span style={{ fontWeight: 900, color: r.state === "완료" ? "#16a34a" : r.state === "오류" ? "#dc2626" : "#b45309" }}>{r.state}</span>
                </div>
              ))}
            </div>
          );
        }
        if (b.kind === "ordered_titles") {
          return (
            <ol key={`o-${i}`} style={{ margin: 0, paddingLeft: 18, color: "#0f172a", fontWeight: 750 }}>
              {b.items.map((it) => (
                <li key={it.order} style={{ marginBottom: 4 }}>
                  {it.title}
                </li>
              ))}
            </ol>
          );
        }
        if (b.kind === "pipeline_grid") {
          return (
            <div key={`p-${i}`} style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>
              {b.rows.map((r) => (
                <div key={r.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b", marginBottom: 4 }}>{r.label}</div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: toneColor(r.tone),
                      padding: "6px 4px",
                      borderRadius: 8,
                      background: "#f1f5f9",
                    }}
                  >
                    {r.stateKo}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        if (b.kind === "bullet_list") {
          return (
            <ul key={`u-${i}`} style={{ margin: 0, paddingLeft: 18, color: "#475569", fontWeight: 750 }}>
              {b.items.map((line, j) => (
                <li key={j}>{line}</li>
              ))}
            </ul>
          );
        }
        if (b.kind === "url_line") {
          return (
            <div key={`url-${i}`} style={{ fontSize: 12, wordBreak: "break-all", fontWeight: 800, color: "#0f766e" }}>
              {b.url}
            </div>
          );
        }
        if (b.kind === "planner_stage_progress") {
          const labels = PROTOTYPE_PLANNER_STAGE_LABELS_KO;
          const current = Math.min(5, Math.max(1, Math.floor(Number(b.currentStep) || 1)));
          /**
           * 5단계는 “진행 중”이 길어질 수 있어 100%로 표기하면 오해가 생김.
           * 실제 완료는 진행 카드가 사라지고 “작업계획이 생성되었습니다” 카드로 교체됨.
           */
          const pct = [20, 40, 60, 80, 90][current - 1];
          return (
            <div key={`planner-st-${i}`} style={{ marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>진행률 약 {pct}%</div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", color: "#334155", fontWeight: 750, fontSize: 12.5 }}>
                {labels.map((label, idx) => {
                  const n = idx + 1;
                  const done = n < current;
                  const active = n === current;
                  const sym = done ? "✓" : active ? "●" : "○";
                  const suffix = done ? " 완료" : active ? " 진행 중" : " 대기";
                  return (
                    <li
                      key={n}
                      style={{
                        marginBottom: 5,
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        color: active ? "#0f766e" : "#334155",
                        fontWeight: active ? 850 : 650,
                      }}
                    >
                      <span
                        style={{
                          flexShrink: 0,
                          width: 18,
                          textAlign: "center",
                          fontWeight: 900,
                          opacity: active ? 1 : done ? 0.95 : 0.55,
                        }}
                        aria-hidden
                      >
                        {sym}
                      </span>
                      <span>
                        {label}
                        {suffix}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/** 인라인 피커에서 “추천 템플릿 사용”(오버라이드 없음)을 나타내는 값 — 실제 `PrototypeTemplateType`과 겹치지 않게 함 */
export const PROTOTYPE_INLINE_TEMPLATE_AI_VALUE = "__jyo_inline_ai_template__";

export type PrototypeInlineTemplatePickerProps = Readonly<{
  /** `PROTOTYPE_INLINE_TEMPLATE_AI_VALUE` 또는 구체 템플릿 id */
  value: string;
  recommendedTemplateId: PrototypeTemplateType;
  onChange: (templateId: string) => void;
  onPreview: () => void;
  onConfirm: () => void;
  /** true면 [확정] 비활성(이미 확정 상태에서 변경 없음) */
  confirmDisabled: boolean;
  disabled: boolean;
}>;

function InlineTemplatePickerRow(p: PrototypeInlineTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const recName = PROTOTYPE_TEMPLATES.find((t) => t.id === p.recommendedTemplateId)?.nameKo ?? p.recommendedTemplateId;
  const currentLabel =
    p.value === PROTOTYPE_INLINE_TEMPLATE_AI_VALUE
      ? `AI 추천 템플릿 · ${recName}`
      : PROTOTYPE_TEMPLATES.find((t) => t.id === p.value)?.nameKo ?? p.value;

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: globalThis.MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerStyle: CSSProperties = {
    width: "100%",
    minHeight: 40,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "8px 10px",
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    background: "#fff",
    textAlign: "left",
    cursor: p.disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    opacity: p.disabled ? 0.55 : 1,
  };

  const confirmLocked = p.disabled || p.confirmDisabled;

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: "1px solid #f1f5f9",
        width: "100%",
        minWidth: 0,
        position: "relative",
        zIndex: open ? 5 : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          width: "100%",
          minWidth: 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 900, color: "#334155", flexShrink: 0 }}>템플릿</span>
        <div ref={wrapRef} style={{ position: "relative", flex: "1 1 160px", minWidth: 120, minHeight: 40 }}>
          <button
            type="button"
            disabled={p.disabled}
            aria-label="템플릿 유형"
            onClick={() => !p.disabled && setOpen((v) => !v)}
            style={triggerStyle}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentLabel}</span>
            <span style={{ flexShrink: 0, color: "#64748b", fontSize: 11 }} aria-hidden>
              ▾
            </span>
          </button>
        {open && !p.disabled ? (
          <div
            role="listbox"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "calc(100% + 4px)",
              zIndex: 50,
              maxHeight: 240,
              overflowY: "auto",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              boxShadow: "0 12px 28px rgba(15,23,42,0.16)",
            }}
          >
            <div
              role="presentation"
              style={{
                padding: "8px 12px 6px",
                fontSize: 11,
                fontWeight: 900,
                color: "#64748b",
                letterSpacing: "0.02em",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              템플릿선택
            </div>
            <button
              type="button"
              role="option"
              aria-selected={p.value === PROTOTYPE_INLINE_TEMPLATE_AI_VALUE}
              onClick={() => {
                p.onChange(PROTOTYPE_INLINE_TEMPLATE_AI_VALUE);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                borderBottom: "1px solid #f1f5f9",
                background: p.value === PROTOTYPE_INLINE_TEMPLATE_AI_VALUE ? "#ecfdf5" : "#fff",
                cursor: "pointer",
                color: "#0f172a",
              }}
            >
              AI 추천 템플릿
              <span style={{ fontWeight: 700, color: "#64748b", fontSize: 12 }}> ({recName})</span>
            </button>
            {PROTOTYPE_TEMPLATES.filter((t) => t.id !== p.recommendedTemplateId).map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={t.id === p.value}
                onClick={() => {
                  p.onChange(t.id);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 800,
                  border: "none",
                  borderBottom: "1px solid #f1f5f9",
                  background: t.id === p.value ? "#ecfdf5" : "#fff",
                  cursor: "pointer",
                  color: "#0f172a",
                }}
              >
                {t.nameKo}
              </button>
            ))}
          </div>
        ) : null}
        </div>
        <button
          type="button"
          onClick={() => p.onPreview()}
          disabled={p.disabled}
          title="템플릿 미리보기"
          aria-label="템플릿 미리보기"
          style={{
            ...chipMuted,
            flexShrink: 0,
            padding: "8px 10px",
            minWidth: 40,
            minHeight: 40,
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0f172a",
            opacity: p.disabled ? 0.55 : 1,
            cursor: p.disabled ? "not-allowed" : "pointer",
          }}
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => p.onConfirm()}
          disabled={confirmLocked}
          style={{
            ...chipPrimary,
            flexShrink: 0,
            padding: "8px 14px",
            minHeight: 40,
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 900,
            opacity: confirmLocked ? 0.5 : 1,
            cursor: confirmLocked ? "not-allowed" : "pointer",
          }}
        >
          확정
        </button>
      </div>
    </div>
  );
}

const PROTOTYPE_BUILD_AI_CARD_HEADER_STYLE: CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.35)",
  background: "#f1f5f9",
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

function PrototypeBuildAiCardHeaderBar() {
  return (
    <div style={PROTOTYPE_BUILD_AI_CARD_HEADER_STYLE}>
      <WorkspaceAiMemberAvatar memberId="prototype_build" size={26} />
      <span style={{ minWidth: 0 }}>AI · {displayedWorkspaceAiTitle("prototype_build")}</span>
    </div>
  );
}

export function PrototypeAiMessage(p: {
  readonly message: PrototypeChatBuiltMessage;
  readonly onAction: (a: PrototypeChatAction) => void;
  readonly templatePicker?: PrototypeInlineTemplatePickerProps | null;
}) {
  const m = p.message;
  const showPicker = Boolean(m.inlineTemplatePicker && p.templatePicker);
  return (
    <div
      style={{
        alignSelf: "flex-start",
        width: "min(100%, 640px)",
        maxWidth: "100%",
        boxSizing: "border-box",
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        background: "#fff",
        boxShadow: "0 8px 28px -18px rgba(15, 23, 42, 0.14)",
        overflow: showPicker ? "visible" : "hidden",
      }}
    >
      <PrototypeBuildAiCardHeaderBar />
      <div style={{ padding: "12px 14px 14px" }}>
        {m.title ? (
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>{m.title}</div>
        ) : null}
        {m.body ? (
          <div style={{ fontSize: 15, color: "#334155", fontWeight: 650, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{m.body}</div>
        ) : null}
        {renderBlocks(m.blocks)}
        {showPicker && p.templatePicker ? <InlineTemplatePickerRow {...p.templatePicker} /> : null}
        {m.actions?.length ? <PrototypeActionChips actions={m.actions} onAction={p.onAction} /> : null}
      </div>
    </div>
  );
}

export function PrototypeUserMessage(p: { readonly text: string; readonly atLabel?: string }) {
  return (
    <div style={{ alignSelf: "flex-end", display: "flex", flexDirection: "column", gap: 6, maxWidth: "100%" }}>
      <div style={{ fontSize: 11, color: "#71717a", paddingRight: 4, textAlign: "right", fontWeight: 800 }}>사용자</div>
      <div style={userBubbleStandard}>
        <div style={{ fontSize: 15, fontWeight: 650, whiteSpace: "pre-wrap" }}>{p.text}</div>
      </div>
    </div>
  );
}

export function PrototypeSystemMessage(p: { readonly text: string }) {
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "min(100%, 640px)", width: "100%" }}>
      <div
        style={{
          fontSize: 11,
          color: "#71717a",
          paddingLeft: 4,
          marginBottom: 6,
          fontWeight: 800,
        }}
      >
        시스템
      </div>
      <div
        style={{
          borderRadius: 14,
          border: "1px solid #bae6fd",
          background: "#f0f9ff",
          padding: "12px 14px",
          fontSize: 15,
          color: "#334155",
          fontWeight: 650,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
        }}
      >
        {p.text}
      </div>
    </div>
  );
}

export type TimelineUserBubble = Readonly<{ id: string; text: string; at: number }>;
export type TimelineEphemeralAi = Readonly<{ id: string; text: string; at: number }>;

/** 서비스 흐름 워크숍에서 쓰던 채팅 확대/축소 아이콘과 동일 SVG */
export function PrototypeChatExpandIcon({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      {expanded ? (
        <>
          <path d="M9 3H5a2 2 0 0 0-2 2v4" />
          <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
          <path d="M3 9l7-7" />
          <path d="M21 15l-7 7" />
        </>
      ) : (
        <>
          <path d="M15 3h4a2 2 0 0 1 2 2v4" />
          <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
          <path d="M21 9l-7-7" />
          <path d="M3 15l7 7" />
        </>
      )}
    </svg>
  );
}

export function PrototypeChatTimeline(p: {
  readonly derived: readonly PrototypeChatBuiltMessage[];
  readonly userBubbles: readonly TimelineUserBubble[];
  readonly ephemeralAi: readonly TimelineEphemeralAi[];
  readonly onAction: (a: PrototypeChatAction) => void;
  readonly cursorPromptResolver: (order: number) => PrototypeWorkUnit | null;
  /** true면 부모가 스크롤 영역(서비스 흐름 정의 화면과 동일) */
  readonly timelineInScrollParent?: boolean;
  /** 템플릿 미선택 시 AI 말풍선 안 콤보에 연결 */
  readonly templatePicker?: PrototypeInlineTemplatePickerProps | null;
}) {
  const rows = useMemo(() => {
    type Row =
      | { sort: number; kind: "derived"; m: PrototypeChatBuiltMessage }
      | { sort: number; kind: "user"; u: TimelineUserBubble }
      | { sort: number; kind: "ephemeral"; e: TimelineEphemeralAi };
    const list: Row[] = [
      ...p.derived.map((m) => ({ sort: m.orderKey, kind: "derived" as const, m })),
      ...p.userBubbles.map((u) => ({ sort: u.at, kind: "user" as const, u })),
      ...p.ephemeralAi.map((e) => ({ sort: e.at, kind: "ephemeral" as const, e })),
    ];
    list.sort((a, b) => (a.sort === b.sort ? (a.kind === "derived" ? -1 : 1) : a.sort - b.sort));
    return list;
  }, [p.derived, p.userBubbles, p.ephemeralAi]);

  const [promptWu, setPromptWu] = useState<PrototypeWorkUnit | null>(null);

  const handleAction = (a: PrototypeChatAction) => {
    if (a.intent === "OPEN_CURSOR_PROMPT" && typeof a.workUnitOrder === "number") {
      const u = p.cursorPromptResolver(a.workUnitOrder);
      if (u) setPromptWu(u);
      return;
    }
    p.onAction(a);
  };

  const listWrapStyle: CSSProperties = p.timelineInScrollParent
    ? { display: "flex", flexDirection: "column", alignItems: "stretch", gap: 16, width: "100%" }
    : {
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 16,
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        paddingRight: 2,
        width: "100%",
      };

  return (
    <>
      <div style={listWrapStyle}>
        {rows.map((row) => {
          if (row.kind === "derived") {
            if (row.m.role === "system") {
              return <PrototypeSystemMessage key={row.m.id} text={row.m.body ?? ""} />;
            }
            return (
              <PrototypeAiMessage
                key={row.m.id}
                message={row.m}
                onAction={handleAction}
                templatePicker={p.templatePicker ?? null}
              />
            );
          }
          if (row.kind === "user") {
            return <PrototypeUserMessage key={row.u.id} text={row.u.text} />;
          }
          return (
            <div
              key={row.e.id}
              style={{
                alignSelf: "flex-start",
                width: "min(100%, 640px)",
                maxWidth: "100%",
                boxSizing: "border-box",
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                background: "#fff",
                boxShadow: "0 8px 28px -18px rgba(15, 23, 42, 0.14)",
                overflow: "hidden",
              }}
            >
              <PrototypeBuildAiCardHeaderBar />
              <div style={{ padding: "12px 14px 14px", fontSize: 15, color: "#334155", fontWeight: 650, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                {row.e.text}
              </div>
            </div>
          );
        })}
      </div>

      {promptWu ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
          onClick={() => setPromptWu(null)}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              maxHeight: "min(80vh, 720px)",
              overflow: "auto",
              background: "#fff",
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              padding: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 1000, color: "#0f172a", marginBottom: 8 }}>
              Cursor 프롬프트 · #{promptWu.order} {promptWu.title}
            </div>
            <pre style={{ fontSize: 11.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
              {promptWu.cursorPrompt ?? ""}
            </pre>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setPromptWu(null)} style={chipMuted}>
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PrototypeChatInput(p: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  readonly placeholder: string;
  readonly disabled: boolean;
  readonly inputRef: React.RefObject<HTMLTextAreaElement | null>;
  /** 서비스 흐름 단계 하단 컴포저(둥근 흰 카드) 안에 넣을 때 */
  readonly embedInComposer?: boolean;
  /** `@@` 멘션 후보 */
  readonly targetPickerItems?: readonly ComposerAtAtPickerItem[];
}) {
  const embedded = Boolean(p.embedInComposer);
  const innerTaRef = useRef<HTMLTextAreaElement | null>(null);
  const { targetPickerOpen, normalizedTargetPickerItems, closeTargetPicker, pickTargetItem } = useComposerAtAtPicker({
    value: p.value,
    onChange: p.onChange,
    items: p.targetPickerItems,
    textareaRef: innerTaRef,
  });

  const autoGrowEmbedded = useCallback(() => {
    if (!embedded) return;
    const el = innerTaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 220;
    el.style.height = `${Math.min(max, el.scrollHeight)}px`;
  }, [embedded]);

  useEffect(() => {
    autoGrowEmbedded();
  }, [p.value, autoGrowEmbedded]);

  return (
    <div
      style={{
        flex: embedded ? "1 1 auto" : undefined,
        minWidth: 0,
        flexShrink: embedded ? undefined : 0,
        display: "flex",
        gap: embedded ? 10 : 8,
        alignItems: "flex-end",
        border: embedded ? "none" : "1px solid #e2e8f0",
        borderRadius: embedded ? 0 : 14,
        padding: embedded ? 0 : 10,
        background: embedded ? "transparent" : "#fff",
      }}
    >
      <button
        type="button"
        aria-label="추가"
        title="추가(준비 중)"
        disabled={p.disabled}
        style={{
          ...(embedded ? {} : chipMuted),
          width: embedded ? 44 : 40,
          height: embedded ? 44 : 40,
          padding: 0,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: embedded ? 999 : undefined,
          border: embedded ? "none" : undefined,
          background: embedded ? "#f1f5f9" : undefined,
          color: embedded ? "#475569" : "#0f172a",
          opacity: p.disabled ? 0.45 : 1,
          cursor: p.disabled ? "not-allowed" : "pointer",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ComposerAtAtTargetPicker
          open={targetPickerOpen}
          items={normalizedTargetPickerItems}
          onPick={pickTargetItem}
          onClose={closeTargetPicker}
        />
        <textarea
          ref={(el) => {
            innerTaRef.current = el;
            if (p.inputRef && "current" in p.inputRef) (p.inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
          }}
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          onInput={embedded ? autoGrowEmbedded : undefined}
          onKeyDown={p.onKeyDown}
          placeholder={p.placeholder}
          rows={1}
          disabled={p.disabled}
          style={{
            flex: "1 1 auto",
            resize: "none",
            borderRadius: embedded ? 0 : 10,
            border: embedded ? "none" : "1px solid #cbd5e1",
            padding: embedded ? "10px 6px" : 8,
            fontSize: embedded ? 16 : 12.5,
            lineHeight: embedded ? 1.5 : 1.45,
            fontWeight: embedded ? 600 : 800,
            minHeight: embedded ? 44 : 44,
            maxHeight: embedded ? 220 : undefined,
            outline: "none",
            background: embedded ? "transparent" : "#fff",
            color: "#0f172a",
            fontFamily: "inherit",
            overflowY: embedded ? "auto" : undefined,
            overflowX: "hidden",
            boxSizing: "border-box",
            width: "100%",
          }}
        />
      </div>
      <button
        type="button"
        onClick={() => p.onSend()}
        disabled={p.disabled || !p.value.trim()}
        aria-label="전송"
        title="전송"
        style={
          embedded
            ? {
                flex: "0 0 auto",
                width: 44,
                height: 44,
                borderRadius: 999,
                border: "none",
                background: p.disabled || !p.value.trim() ? "#cbd5e1" : "linear-gradient(180deg, #0f766e 0%, #0d5c56 100%)",
                color: "#fff",
                cursor: p.disabled ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                lineHeight: 1,
                boxShadow: p.disabled || !p.value.trim() ? "none" : "0 8px 20px -6px rgba(13, 92, 86, 0.45)",
              }
            : chipPrimary
        }
      >
        {embedded ? (
          <span aria-hidden style={{ fontSize: 17, lineHeight: 1, transform: "translateX(1px)", display: "inline-block" }}>
            ➤
          </span>
        ) : (
          "전송"
        )}
      </button>
    </div>
  );
}

export function PrototypeChatShell(p: {
  readonly children: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        background: "#fafafa",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
        minHeight: 0,
        flex: "1 1 auto",
        height: "100%",
      }}
    >
      {p.children}
    </div>
  );
}
