"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceAiHeaderWithAvatar } from "@/components/ai-member/WorkspaceAiHeaderWithAvatar";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";
import { uiTokens as t } from "@/components/ui/tokens";
import { WorkspaceMessageList } from "@/components/workspace/WorkspaceMessageList";
import { useWorkspaceScrollToEnd } from "@/components/workspace/useWorkspaceScroll";
import {
  WORKSPACE_STANDARD_CHAT_BODY_STYLE,
  WORKSPACE_STANDARD_CHAT_HEADER_STYLE,
  workspaceStandardChatBubbleShell,
} from "@/components/workspace/workspaceStandardChatMessage";

export type WorkspaceChatNavChip = Readonly<{
  slotId: string;
  label: string;
}>;

export type WorkspaceChatMessage = Readonly<{
  id: string;
  role: "user" | "ai";
  text: string;
  at: string;
  /** 기능 정리 등 — AI 턴 요약 카드 */
  resultSummary?: Readonly<{ title: string; lines: readonly string[] }>;
  /** 기능 정리 — 이어지는 영역 버튼 */
  slotNavChips?: readonly WorkspaceChatNavChip[];
}>;

type SelectionBubble = { readonly text: string; readonly left: number; readonly top: number };

async function copyTextToClipboard(text: string): Promise<void> {
  const t = text.trim();
  if (!t) return;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {
    /* ignore */
  }
}

export function WorkspaceChatPanel({
  messages,
  loading,
  loadingHint,
  emptyHint,
  onSlotNavChipClick,
  slotDigestLoading,
  onChatSelectionToWorkNote,
  workspaceAiMemberId = "feature_planning",
}: {
  readonly messages: readonly WorkspaceChatMessage[];
  readonly loading?: boolean;
  readonly loadingHint?: string;
  readonly emptyHint?: ReactNode;
  readonly onSlotNavChipClick?: (slotId: string) => void;
  readonly slotDigestLoading?: boolean;
  /** 지정 시 채팅 영역에서 드래그 선택 후 작업메모로 보낼 수 있음 */
  readonly onChatSelectionToWorkNote?: (text: string) => void;
  /** 기능 정리 등 — 채팅 헤더에 표시할 전담 AI */
  readonly workspaceAiMemberId?: WorkspaceAiMemberId;
}) {
  const endRef = useWorkspaceScrollToEnd(`${messages.length}-${loading ? 1 : 0}`);
  const chatRootRef = useRef<HTMLDivElement | null>(null);
  const selectionToolbarRef = useRef<HTMLDivElement | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<SelectionBubble | null>(null);

  const clearSelectionBubble = useCallback(() => setSelectionBubble(null), []);

  /** 툴바 밖을 누르거나 선택이 풀리면 툴바 닫기 */
  useEffect(() => {
    if (!onChatSelectionToWorkNote || !selectionBubble) return;
    const onPointerDownCapture = (e: PointerEvent) => {
      const node = e.target as Node | null;
      if (!node) return;
      if (selectionToolbarRef.current?.contains(node)) return;
      clearSelectionBubble();
    };
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [onChatSelectionToWorkNote, selectionBubble, clearSelectionBubble]);

  useEffect(() => {
    if (!onChatSelectionToWorkNote || !selectionBubble) return;
    const root = chatRootRef.current;
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        clearSelectionBubble();
        return;
      }
      if (!root || sel.rangeCount === 0) {
        clearSelectionBubble();
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        clearSelectionBubble();
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [onChatSelectionToWorkNote, selectionBubble, clearSelectionBubble]);

  useEffect(() => {
    if (!onChatSelectionToWorkNote) return;
    const onMouseUp = () => {
      window.requestAnimationFrame(() => {
        const root = chatRootRef.current;
        const sel = window.getSelection();
        if (!root || !sel || sel.isCollapsed) {
          setSelectionBubble(null);
          return;
        }
        if (sel.rangeCount === 0) {
          setSelectionBubble(null);
          return;
        }
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) {
          setSelectionBubble(null);
          return;
        }
        const text = sel.toString().replace(/\u00a0/g, " ").trim();
        if (text.length < 2) {
          setSelectionBubble(null);
          return;
        }
        const rect = range.getBoundingClientRect();
        setSelectionBubble({
          text,
          left: rect.left + rect.width / 2,
          top: rect.top,
        });
      });
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [onChatSelectionToWorkNote, messages.length]);

  useEffect(() => {
    if (!onChatSelectionToWorkNote) return;
    const root = chatRootRef.current;
    if (!root) return;
    const onScroll = () => setSelectionBubble(null);
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [onChatSelectionToWorkNote, messages.length]);

  return (
    <>
      <WorkspaceMessageList
        scrollRootRef={onChatSelectionToWorkNote ? chatRootRef : undefined}
        endRef={endRef}
        beforeMessages={null}
      >
      {!messages.length && !loading ? emptyHint : null}
      {messages.map((m) => {
        if (m.role === "user") {
          return (
            <div key={m.id} style={{ justifySelf: "end", maxWidth: "78%", width: "fit-content", minWidth: 0 }}>
              <div style={workspaceStandardChatBubbleShell("user")}>
                <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>사용자</div>
                <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>{m.text}</div>
              </div>
            </div>
          );
        }
        return (
          <div key={m.id} style={{ justifySelf: "start", maxWidth: "min(100%, 620px)", width: "fit-content", minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <div style={workspaceStandardChatBubbleShell("ai")}>
                <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>
                  <WorkspaceAiHeaderWithAvatar memberId={workspaceAiMemberId}>
                    AI · {displayedWorkspaceAiTitle(workspaceAiMemberId)}
                  </WorkspaceAiHeaderWithAvatar>
                </div>
                <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>{m.text}</div>
                {m.resultSummary?.lines?.length ? (
                  <div
                    role="note"
                    aria-label={`${m.resultSummary.title}: ${m.resultSummary.lines.join(" ")}`}
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: `1px solid ${t.border}`,
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "6px 10px",
                      fontSize: 11,
                      lineHeight: 1.35,
                      color: t.textMuted,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 900,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontSize: 10,
                        color: t.textMuted,
                        background: t.bgPage,
                        border: `1px solid ${t.border}`,
                        borderRadius: 6,
                        padding: "2px 7px",
                      }}
                    >
                      {m.resultSummary.title}
                    </span>
                    <span style={{ fontWeight: 600, color: t.textSecondary }}>{m.resultSummary.lines.join(" · ")}</span>
                  </div>
                ) : null}
              </div>
              {m.slotNavChips?.length && onSlotNavChipClick ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted }}>다른 영역</span>
                  {m.slotNavChips.map((c) => (
                    <button
                      key={`${m.id}-${c.slotId}`}
                      type="button"
                      disabled={Boolean(slotDigestLoading)}
                      onClick={() => onSlotNavChipClick(c.slotId)}
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: `1px solid ${t.border}`,
                        background: t.bgCard,
                        color: t.textPrimary,
                        cursor: slotDigestLoading ? "wait" : "pointer",
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {loading ? (
        <div style={{ justifySelf: "start", fontSize: 12, fontWeight: 800, color: t.textMuted }}>
          {loadingHint?.trim() ? loadingHint : "응답을 기다리는 중…"}
        </div>
      ) : null}
    </WorkspaceMessageList>
      {selectionBubble && onChatSelectionToWorkNote ? (
        <div
            ref={selectionToolbarRef}
            role="toolbar"
            aria-label="선택 텍스트 작업"
            style={{
              position: "fixed",
              zIndex: 50,
              left: Math.max(12, Math.min(window.innerWidth - 12, selectionBubble.left)),
              top: Math.max(8, selectionBubble.top - 44),
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 8px",
              borderRadius: 10,
              border: `1px solid ${t.borderStrong}`,
              background: t.bgCard,
              boxShadow: t.shadowModal,
            }}
          >
            <button
              type="button"
              data-testid="chat-selection-to-work-note"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const snippet = selectionBubble.text;
                void copyTextToClipboard(snippet);
                onChatSelectionToWorkNote(snippet);
                clearSelectionBubble();
                window.getSelection()?.removeAllRanges();
              }}
              style={{
                border: 0,
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                background: t.accentTeal,
                color: "#fff",
              }}
            >
              작업메모에 넣기
            </button>
          </div>
      ) : null}
    </>
  );
}
