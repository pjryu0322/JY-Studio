"use client";

import type { ReactNode } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { displayedAiOrchestrator } from "@/lib/ai-member/visibleAiOrchestrator";
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

export function WorkspaceChatPanel({
  messages,
  loading,
  loadingHint,
  emptyHint,
  screenLabel,
  onSlotNavChipClick,
  slotDigestLoading,
}: {
  readonly messages: readonly WorkspaceChatMessage[];
  readonly loading?: boolean;
  readonly loadingHint?: string;
  readonly emptyHint?: ReactNode;
  readonly screenLabel?: string;
  readonly onSlotNavChipClick?: (slotId: string) => void;
  readonly slotDigestLoading?: boolean;
}) {
  const showScreenLabels = useShowScreenLabels();
  const endRef = useWorkspaceScrollToEnd(`${messages.length}-${loading ? 1 : 0}`);

  return (
    <WorkspaceMessageList
      endRef={endRef}
      beforeMessages={screenLabel ? <ScreenLabel label={screenLabel} visible={showScreenLabels} /> : null}
    >
      {!messages.length && !loading ? emptyHint : null}
      {messages.map((m) => {
        if (m.role === "user") {
          return (
            <div key={m.id} style={{ justifySelf: "end", maxWidth: "78%", width: "100%", minWidth: 0 }}>
              <div style={workspaceStandardChatBubbleShell("user")}>
                <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>사용자</div>
                <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>{m.text}</div>
              </div>
            </div>
          );
        }
        return (
          <div key={m.id} style={{ justifySelf: "start", maxWidth: "min(100%, 620px)", width: "100%", minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              <div style={workspaceStandardChatBubbleShell("ai")}>
                <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>AI · {displayedAiOrchestrator().name}</div>
                <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>{m.text}</div>
              </div>
              {m.resultSummary?.lines?.length ? (
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${t.border}`,
                    background: t.bgCard,
                    padding: "12px 14px 14px",
                    fontSize: 14,
                    color: t.textPrimary,
                    lineHeight: 1.55,
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>{m.resultSummary.title}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: t.textSecondary }}>
                    {m.resultSummary.lines.map((line, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
  );
}
