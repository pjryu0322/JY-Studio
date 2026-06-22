"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uiTokens as t } from "@/components/ui";
import { WorkspaceHubChromeIconButton } from "@/components/workspace/WorkspaceHubChromeIconButton";
import { patchMessengerRoomTitle } from "@/lib/messenger/messengerChatRoomApi";

export function MessengerRoomEnterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

export function MessengerRoomLeaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function MessengerRoomDeleteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function MessengerRoomListTitleField(p: {
  readonly roomId: string;
  readonly title: string;
  readonly disabled?: boolean;
  readonly onSaved: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(p.title);
  }, [p.title, editing]);

  useEffect(() => {
    if (!editing) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [editing]);

  const cancelEdit = useCallback(() => {
    if (saving) return;
    setDraft(p.title);
    setError(null);
    setEditing(false);
  }, [p.title, saving]);

  const saveTitle = useCallback(async () => {
    if (saving || p.disabled) return;
    const next = draft.trim();
    if (!next) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (next === p.title.trim()) {
      setEditing(false);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await patchMessengerRoomTitle(p.roomId, next);
      setEditing(false);
      await p.onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 오류");
    } finally {
      setSaving(false);
    }
  }, [draft, p, saving]);

  if (editing) {
    return (
      <div style={{ marginBottom: 4 }}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          disabled={saving || p.disabled}
          maxLength={120}
          aria-label="대화방 제목"
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void saveTitle();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelEdit();
            }
          }}
          onBlur={() => {
            void saveTitle();
          }}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontSize: 15,
            fontWeight: 900,
            color: t.textPrimary,
            border: `1px solid ${error ? "#f87171" : "#94a3b8"}`,
            borderRadius: 8,
            padding: "6px 10px",
            outline: "none",
          }}
        />
        {error ? (
          <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, fontWeight: 700 }}>{error}</div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={p.disabled || saving}
      title="제목 변경 (클릭하여 수정)"
      aria-label={`대화방 제목: ${p.title}. 클릭하여 수정`}
      onClick={() => {
        if (p.disabled) return;
        setDraft(p.title);
        setError(null);
        setEditing(true);
      }}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        marginBottom: 4,
        padding: 0,
        border: 0,
        background: "transparent",
        cursor: p.disabled ? "not-allowed" : "text",
        fontSize: 15,
        fontWeight: 900,
        color: t.textPrimary,
        opacity: p.disabled ? 0.55 : 1,
      }}
    >
      {p.title}
    </button>
  );
}

export function MessengerRoomListActionButtons(p: {
  readonly disabled?: boolean;
  readonly showDelete?: boolean;
  readonly onEnter: () => void;
  readonly onLeave: () => void;
  readonly onDelete?: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexShrink: 0 }}>
      <WorkspaceHubChromeIconButton
        title="대화방 입장 (새 창)"
        ariaLabel="대화방 입장 — 새 창에서 열기"
        disabled={p.disabled}
        onClick={p.onEnter}
      >
        <MessengerRoomEnterIcon />
      </WorkspaceHubChromeIconButton>
      <WorkspaceHubChromeIconButton
        title="대화방 나가기"
        ariaLabel="대화방 나가기"
        disabled={p.disabled}
        onClick={p.onLeave}
      >
        <MessengerRoomLeaveIcon />
      </WorkspaceHubChromeIconButton>
      {p.showDelete && p.onDelete ? (
        <WorkspaceHubChromeIconButton
          title="대화방 삭제"
          ariaLabel="대화방 삭제"
          disabled={p.disabled}
          emphasisTone="danger"
          onClick={p.onDelete}
        >
          <MessengerRoomDeleteIcon />
        </WorkspaceHubChromeIconButton>
      ) : null}
    </div>
  );
}
