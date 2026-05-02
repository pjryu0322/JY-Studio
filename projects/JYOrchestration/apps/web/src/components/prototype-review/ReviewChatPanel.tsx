"use client";

import type { CSSProperties, FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ComposerAtAtTargetPicker } from "@/components/composer/ComposerAtAtTargetPicker";
import { useComposerAtAtPicker } from "@/hooks/useComposerAtAtPicker";
import type { ComposerAtAtPickerItem } from "@/lib/composer/composerAtAtPicker";
import type { PrototypeImprovementItem, PrototypeReviewMessage } from "@/lib/prototype/prototypeReviewStore";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { uiTokens as t } from "@/components/ui/tokens";
import { ReviewImprovementDetailModal } from "@/components/prototype-review/ReviewImprovementDetailModal";

/** 플로팅 독: 자식 레이어가 불투명하면 shell 투명도가 전혀 보이지 않으므로 큰 면은 모두 알파 배경 사용 */
function dockGlass(sa: number) {
  const a = Math.min(1, Math.max(0.12, sa));
  const userTint = Math.min(0.48, 0.05 + a * 0.4);
  const expertTint = Math.min(0.48, 0.05 + a * 0.4);
  return {
    shell: `rgba(255, 255, 255, ${a})`,
    scroll: `rgba(241, 245, 249, ${Math.min(1, a + 0.08)})`,
    card: `rgba(255, 255, 255, ${Math.min(1, a + 0.04)})`,
    page: `rgba(248, 250, 252, ${Math.min(1, a + 0.06)})`,
    input: `rgba(255, 255, 255, ${Math.min(1, a + 0.14)})`,
    /** 대화 말풍선 — 투명도 슬라이더와 함께 비침 */
    bubblePlanner: `rgba(248, 250, 252, ${Math.min(1, a + 0.03)})`,
    bubbleUser: `rgba(37, 99, 235, ${userTint})`,
    bubbleExpert: `rgba(13, 148, 136, ${expertTint})`,
  };
}

function shellStyle(
  compact: boolean,
  fillParent: boolean,
  floating: boolean,
  surfaceAlpha: number | undefined,
  omitChrome: boolean,
): CSSProperties {
  const sa = typeof surfaceAlpha === "number" ? Math.min(1, Math.max(0.2, surfaceAlpha)) : floating ? 0.98 : 1;
  const docked = Boolean(floating && omitChrome);
  const glass = docked && typeof surfaceAlpha === "number" ? dockGlass(surfaceAlpha) : null;
  const shellBg = floating ? (glass ? glass.shell : `rgba(255, 255, 255, ${sa})`) : t.bgCard;
  return {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    minHeight: compact ? 0 : floating ? 0 : 280,
    height: fillParent ? "100%" : compact ? "100%" : undefined,
    maxHeight: fillParent ? "100%" : compact ? "100%" : "36vh",
    borderRadius: docked ? 0 : t.radiusLg,
    border: docked ? "none" : `1px solid ${floating ? t.borderStrong : t.border}`,
    borderTop: docked ? `1px solid ${t.border}` : undefined,
    background: shellBg,
    overflow: "hidden",
    boxShadow: floating && !docked ? "0 16px 48px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.06)" : undefined,
    backdropFilter: floating && !docked ? "blur(8px)" : floating ? "blur(6px)" : undefined,
  };
}

function roleLabel(role: PrototypeReviewMessage["role"]): string {
  if (role === "planner") return "AI기획자";
  if (role === "expert") return "전문가";
  return "사용자";
}

const DEFAULT_REVIEW_COMPOSER_AT_AT: readonly ComposerAtAtPickerItem[] = [
  { id: "review:planner", label: "AI기획자", targets: [{ id: "planner", name: "AI기획자" }] },
  { id: "review:expert", label: "전문가", targets: [{ id: "expert", name: "전문가" }] },
  { id: "review:user", label: "사용자", targets: [{ id: "user", name: "사용자" }] },
];

function bubbleStyle(role: PrototypeReviewMessage["role"], glass: ReturnType<typeof dockGlass> | null): CSSProperties {
  const isPlanner = role === "planner";
  const isExpert = role === "expert";

  let background: string;
  let borderColor: string;
  if (glass) {
    if (role === "planner") {
      background = glass.bubblePlanner;
      borderColor = t.border;
    } else if (role === "expert") {
      background = glass.bubbleExpert;
      borderColor = "rgba(13, 148, 136, 0.34)";
    } else {
      background = glass.bubbleUser;
      borderColor = "rgba(37, 99, 235, 0.32)";
    }
  } else {
    background = isPlanner ? t.bgPage : isExpert ? `${t.accentTeal}18` : `${t.primary}14`;
    borderColor = isPlanner ? t.border : isExpert ? `${t.accentTeal}40` : `${t.primary}35`;
  }

  return {
    alignSelf: isPlanner ? "flex-start" : "flex-end",
    maxWidth: "min(94%, 520px)",
    padding: "10px 14px",
    borderRadius: isPlanner ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
    background,
    border: `1px solid ${borderColor}`,
    fontSize: 13,
    lineHeight: 1.55,
    color: t.textPrimary,
    whiteSpace: "pre-wrap",
    boxShadow: isPlanner ? "none" : "0 1px 0 rgba(37, 99, 235, 0.08)",
  };
}

export function ReviewChatPanel(p: {
  readonly compact?: boolean;
  readonly fillParent?: boolean;
  /** 프리뷰 위 오버레이일 때 카드·그림자 강조 */
  readonly floating?: boolean;
  /** 플로팅 독 사용 시 상단 제목 블록 숨김(독 툴바에 표시) */
  readonly omitChrome?: boolean;
  /** 플로팅 패널 배경 알파(약 0.35~1). omitChrome과 함께 쓰는 것을 권장 */
  readonly surfaceAlpha?: number;
  readonly disabled: boolean;
  readonly messages: PrototypeReviewMessage[];
  readonly improvementItems: PrototypeImprovementItem[] | null;
  readonly improvementsLoading?: boolean;
  readonly improvementsError?: string | null;
  readonly threadLoading?: boolean;
  readonly busy: boolean;
  readonly busyAction: "send" | "summarize" | "improvements" | "drafts" | null;
  readonly onSend: (text: string) => void;
  readonly onSummarize: () => void;
  readonly onImprovements: () => void;
  readonly onFollowUpDrafts: () => void;
  /** 비우면 AI기획자·전문가·사용자 기본 멘션 */
  readonly composerAtAtItems?: readonly ComposerAtAtPickerItem[];
}) {
  const [text, setText] = useState("");
  const [modalItem, setModalItem] = useState<PrototypeImprovementItem | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const composerTaRef = useRef<HTMLTextAreaElement | null>(null);
  const atAtItems = p.composerAtAtItems ?? DEFAULT_REVIEW_COMPOSER_AT_AT;
  const { targetPickerOpen, normalizedTargetPickerItems, closeTargetPicker, pickTargetItem } = useComposerAtAtPicker({
    value: text,
    onChange: setText,
    items: atAtItems,
    textareaRef: composerTaRef,
  });
  const compact = Boolean(p.compact);
  const fillParent = Boolean(p.fillParent);
  const floating = Boolean(p.floating);
  const omitChrome = Boolean(p.omitChrome);
  const sa = typeof p.surfaceAlpha === "number" ? p.surfaceAlpha : undefined;
  const glass = floating && omitChrome && typeof sa === "number" ? dockGlass(sa) : null;
  const scrollBg = glass ? glass.scroll : "#f1f5f9";
  const footerBg = glass ? glass.card : t.bgCard;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [p.messages.length, p.improvementItems?.length, p.improvementsLoading]);

  function submitMessage() {
    const v = text.trim();
    if (!v || p.busy || p.disabled) return;
    setText("");
    p.onSend(v);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submitMessage();
  }

  function onTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    submitMessage();
  }

  return (
    <section
      aria-label="프로토타입 검토 대화"
      style={{
        ...shellStyle(compact, fillParent, floating, sa, omitChrome),
        paddingBottom: omitChrome ? 14 : undefined,
        boxSizing: "border-box",
      }}
    >
      {!omitChrome ? (
        <div
          style={{
            padding: "10px 14px 8px",
            borderBottom: `1px solid ${t.border}`,
            background: t.bgCard,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: t.textPrimary }}>검토 대화</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>사용자 · 전문가 · AI기획자와 나눈 내용이 여기에 쌓입니다.</div>
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 0,
          background: scrollBg,
        }}
      >
        {p.threadLoading ? (
          <div style={{ fontSize: 13, color: t.textMuted, padding: 8 }}>대화 불러오는 중…</div>
        ) : null}

        {p.messages.map((m) => (
          <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: t.textMuted,
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                paddingLeft: m.role === "user" ? 0 : 4,
                paddingRight: m.role === "user" ? 4 : 0,
              }}
            >
              {roleLabel(m.role)}
            </span>
            <div style={bubbleStyle(m.role, glass)}>{m.content}</div>
          </div>
        ))}

        <div id="jyo-prototype-review-change-requests" style={{ alignSelf: "stretch", scrollMarginTop: 12 }}>
          {p.improvementsLoading ? (
            <div
              style={{
                alignSelf: "stretch",
                padding: 14,
                borderRadius: 12,
                border: `1px dashed ${t.borderStrong}`,
                background: glass ? glass.card : t.bgCard,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: t.textMuted, marginBottom: 8 }}>AI기획자 · AI개선안</div>
              <LoadingState label="개선안을 준비하는 중…" />
            </div>
          ) : null}

          {!p.improvementsLoading && p.improvementItems && p.improvementItems.length > 0 ? (
            <div
              style={{
                alignSelf: "stretch",
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                background: glass ? glass.card : t.bgCard,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, color: t.primary, marginBottom: 10 }}>AI기획자 · AI개선안</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {p.improvementItems.map((it, idx) => (
                  <button
                    key={`${it.title}-${idx}`}
                    type="button"
                    onClick={() => setModalItem(it)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: t.radiusMd,
                      border: `1px solid ${t.border}`,
                      background: glass ? glass.page : t.bgPage,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      color: t.textPrimary,
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ color: t.textMuted, fontWeight: 800, marginRight: 8 }}>{idx + 1}.</span>
                    {it.title}
                    <span style={{ display: "block", marginTop: 4, fontSize: 12, fontWeight: 600, color: t.textMuted }}>탭하여 상세 보기</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {p.improvementsError ? (
          <div style={{ fontSize: 12, color: t.warning, padding: "0 4px", lineHeight: 1.5 }}>{p.improvementsError}</div>
        ) : null}

        <div ref={endRef} />
      </div>

      <div style={{ borderTop: `1px solid ${t.border}`, padding: 10, display: "flex", flexWrap: "wrap", gap: 8, background: footerBg }}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={p.disabled || p.busy}
          loading={p.busyAction === "summarize"}
          onClick={p.onSummarize}
        >
          정리요청
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={p.disabled || p.busy || Boolean(p.improvementsLoading)}
          loading={p.busyAction === "improvements"}
          onClick={p.onImprovements}
        >
          {p.improvementItems?.length ? "개선안 다시 받기" : "개선안 보기"}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={p.disabled || p.busy}
          loading={p.busyAction === "drafts"}
          onClick={p.onFollowUpDrafts}
        >
          보완작업 생성
        </Button>
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          borderTop: `1px solid ${t.border}`,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: footerBg,
          overflow: "visible",
          position: "relative",
          zIndex: 6,
        }}
      >
        <label htmlFor="jyo-review-chat-input" style={{ fontSize: 12, fontWeight: 800, color: t.textMuted }}>
          메시지
        </label>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 0 }}>
          <ComposerAtAtTargetPicker
            open={targetPickerOpen}
            items={normalizedTargetPickerItems}
            onPick={pickTargetItem}
            onClose={closeTargetPicker}
          />
          <textarea
            id="jyo-review-chat-input"
            ref={composerTaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            disabled={p.disabled || p.busy}
            placeholder="프로토타입을 보며 개선 요청을 입력하세요."
            rows={compact ? 2 : 2}
            style={{
              width: "100%",
              resize: "vertical",
              padding: 10,
              borderRadius: t.radiusMd,
              border: `1px solid ${t.borderStrong}`,
              fontSize: 13,
              lineHeight: 1.45,
              boxSizing: "border-box",
              minHeight: 72,
              background: glass ? glass.input : t.bgCard,
            }}
          />
        </div>
        <Button type="submit" variant="primary" size="md" disabled={p.disabled || p.busy || !text.trim()} loading={p.busyAction === "send"}>
          보내기
        </Button>
      </form>

      <ReviewImprovementDetailModal item={modalItem} onClose={() => setModalItem(null)} />
    </section>
  );
}
