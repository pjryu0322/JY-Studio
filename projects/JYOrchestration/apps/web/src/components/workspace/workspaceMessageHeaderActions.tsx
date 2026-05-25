"use client";

import type { CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export const workspaceMessageIconActionBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 4,
  borderRadius: 8,
  cursor: "pointer",
  color: t.textMuted,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export function WorkspaceMessageCopyIcon({ size = 16 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function WorkspaceMessageReplyIcon({ size = 16 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 17H4v-5" />
      <path d="M20 4 9 15" />
    </svg>
  );
}

export async function copyTextToClipboard(text: string): Promise<void> {
  const t = String(text ?? "").trim();
  if (!t) return;
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    /* ignore */
  }
}

export function WorkspaceMessageHeaderActions({
  show,
  onCopy,
  onReply,
}: {
  readonly show: boolean;
  readonly onCopy: () => void;
  readonly onReply?: () => void;
}) {
  if (!show) return null;
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
      }}
      aria-label="메시지 작업"
    >
      {onReply ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReply();
          }}
          style={workspaceMessageIconActionBtn}
          title="답글"
          aria-label="답글"
        >
          <WorkspaceMessageReplyIcon />
        </button>
      ) : null}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void onCopy();
        }}
        style={workspaceMessageIconActionBtn}
        title="복사"
        aria-label="메시지 복사"
      >
        <WorkspaceMessageCopyIcon />
      </button>
    </div>
  );
}

export function WorkspaceMessageReplyContextLine({ label }: { readonly label: string }) {
  if (!label.trim()) return null;
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#64748b",
        marginBottom: 8,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      title={label}
    >
      {label}
    </div>
  );
}

export function WorkspaceChatReplyComposerBar({
  preview,
  onClear,
}: {
  readonly preview: string;
  readonly onClear: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 800,
          color: "#475569",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={preview}
      >
        <span style={{ fontWeight: 700, color: "#0f172a" }}>{preview || "답글 작성 중"}</span>
      </div>
      <button
        type="button"
        onClick={onClear}
        style={{
          border: "1px solid #e2e8f0",
          background: "#fff",
          borderRadius: 999,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 800,
          color: "#475569",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        취소 ×
      </button>
    </div>
  );
}
