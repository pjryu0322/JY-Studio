"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui";

export function MessengerChatRoomRenameModal(p: {
  readonly open: boolean;
  readonly initialTitle: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onClose: () => void;
  readonly onSave: () => void | Promise<void>;
  readonly saving: boolean;
  readonly error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const revertAndClose = useCallback(() => {
    if (p.saving) return;
    p.onChange(p.initialTitle);
    p.onClose();
  }, [p.saving, p.initialTitle, p.onChange, p.onClose]);

  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || p.saving) return;
      e.preventDefault();
      revertAndClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [p.open, p.saving, revertAndClose]);

  useEffect(() => {
    if (!p.open) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.select();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [p.open, p.initialTitle]);

  if (!p.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="대화방 제목 바꾸기"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 96,
        background: t.overlayScrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onMouseDown={() => {
        revertAndClose();
      }}
    >
      <div
        style={{
          width: "min(96vw, 420px)",
          borderRadius: t.radiusLg,
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          padding: 16,
          boxSizing: "border-box",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          id="messenger-room-title-input"
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!p.saving) void p.onSave();
            }
          }}
          maxLength={200}
          disabled={p.saving}
          aria-label="대화방 제목"
          placeholder="대화방 제목"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: t.radiusMd,
            border: `1px solid ${t.borderStrong}`,
            fontSize: 15,
            fontWeight: 700,
          }}
        />
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>{p.value.length}/200</div>
        {p.error ? (
          <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 10, fontWeight: 700 }}>{p.error}</div>
        ) : null}
      </div>
    </div>
  );
}

function SvgPencilEdit({ size = 18 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MessengerRoomTitleEditButton(p: { readonly onClick: () => void; readonly disabled?: boolean }) {
  return (
    <button
      type="button"
      title="제목 편집"
      aria-label="대화방 제목 편집"
      disabled={p.disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        p.onClick();
      }}
      style={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: "#fff",
        color: "#475569",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: p.disabled ? "not-allowed" : "pointer",
        opacity: p.disabled ? 0.45 : 1,
        padding: 0,
      }}
    >
      <SvgPencilEdit />
    </button>
  );
}

function SvgTrash({ size = 18 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function SvgLeaveDoor({ size = 18 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function MessengerRoomDeleteButton(p: {
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly title?: string;
}) {
  return (
    <button
      type="button"
      title={p.title ?? "대화방 삭제"}
      aria-label="대화방 삭제"
      disabled={p.disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        p.onClick();
      }}
      style={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid #fecaca",
        background: "#fff",
        color: "#b91c1c",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: p.disabled ? "not-allowed" : "pointer",
        opacity: p.disabled ? 0.45 : 1,
        padding: 0,
      }}
    >
      <SvgTrash />
    </button>
  );
}

export function MessengerRoomLeaveButton(p: { readonly onClick: () => void; readonly disabled?: boolean }) {
  return (
    <button
      type="button"
      title="대화방 나가기"
      aria-label="대화방 나가기"
      disabled={p.disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        p.onClick();
      }}
      style={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: "#fff",
        color: "#475569",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: p.disabled ? "not-allowed" : "pointer",
        opacity: p.disabled ? 0.45 : 1,
        padding: 0,
      }}
    >
      <SvgLeaveDoor />
    </button>
  );
}

function SvgGear({ size = 18 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

const menuItemBase: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  border: 0,
  borderRadius: 8,
  background: "transparent",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  color: t.textPrimary,
};

const menuItemDisabled: CSSProperties = {
  ...menuItemBase,
  cursor: "not-allowed",
  opacity: 0.45,
  color: t.textMuted,
};

/**
 * 제목 옆 설정(톱니) — 제목 변경·대화 설정·요약/프로젝트(선택)·나가기·삭제.
 */
export function MessengerRoomSettingsGearMenu(p: {
  readonly disabled?: boolean;
  readonly menuBusy?: boolean;
  readonly showRename: boolean;
  readonly showAiSettings?: boolean;
  readonly showAiSummarize?: boolean;
  readonly showProjectApply?: boolean;
  readonly aiSummarizeDisabled?: boolean;
  readonly projectApplyDisabled?: boolean;
  readonly showLeave: boolean;
  readonly showDelete: boolean;
  readonly onRename: () => void;
  readonly onAiSettings?: () => void;
  readonly onAiSummarize?: () => void;
  readonly onProjectApply?: () => void;
  readonly onLeave: () => void | Promise<void>;
  readonly onDelete: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const busy = Boolean(p.disabled || p.menuBusy);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open]);

  const closeAnd = (fn: () => void | Promise<void>) => {
    setOpen(false);
    void fn();
  };

  if (
    !p.showRename &&
    !p.showLeave &&
    !p.showDelete &&
    !p.showAiSettings &&
    !p.showAiSummarize &&
    !p.showProjectApply
  ) {
    return null;
  }

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        title="대화방 설정"
        aria-label="대화방 설정"
        aria-expanded={open}
        disabled={busy}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (busy) return;
          setOpen((v) => !v);
        }}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: open ? "#f1f5f9" : "#fff",
          color: "#475569",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.45 : 1,
          padding: 0,
        }}
      >
        <SvgGear />
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 168,
            zIndex: 80,
            background: t.bgCard,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            boxShadow: "0 10px 40px rgba(15, 23, 42, 0.12)",
            padding: 6,
            boxSizing: "border-box",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {p.showRename ? (
            <button
              type="button"
              role="menuitem"
              style={menuItemBase}
              onClick={() => closeAnd(p.onRename)}
            >
              제목 변경
            </button>
          ) : null}
          {p.showAiSettings && p.onAiSettings ? (
            <button
              type="button"
              role="menuitem"
              style={menuItemBase}
              onClick={() => {
                const openAi = p.onAiSettings;
                if (openAi) closeAnd(openAi);
              }}
            >
              대화 설정
            </button>
          ) : null}
          {p.showAiSummarize && p.onAiSummarize ? (
            <button
              type="button"
              role="menuitem"
              style={p.aiSummarizeDisabled ? menuItemDisabled : menuItemBase}
              disabled={p.aiSummarizeDisabled}
              onClick={() => {
                if (p.aiSummarizeDisabled) return;
                const fn = p.onAiSummarize;
                if (fn) closeAnd(fn);
              }}
            >
              AI요약 정리하기
            </button>
          ) : null}
          {p.showProjectApply && p.onProjectApply ? (
            <button
              type="button"
              role="menuitem"
              style={p.projectApplyDisabled ? menuItemDisabled : menuItemBase}
              disabled={p.projectApplyDisabled}
              onClick={() => {
                if (p.projectApplyDisabled) return;
                const fn = p.onProjectApply;
                if (fn) closeAnd(fn);
              }}
            >
              프로젝트 적용
            </button>
          ) : null}
          {p.showLeave ? (
            <button
              type="button"
              role="menuitem"
              style={{ ...menuItemBase, color: t.textSecondary }}
              onClick={() => closeAnd(p.onLeave)}
            >
              나가기
            </button>
          ) : null}
          {p.showDelete ? (
            <button
              type="button"
              role="menuitem"
              style={{ ...menuItemBase, color: "#b91c1c" }}
              onClick={() => closeAnd(p.onDelete)}
            >
              삭제
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
