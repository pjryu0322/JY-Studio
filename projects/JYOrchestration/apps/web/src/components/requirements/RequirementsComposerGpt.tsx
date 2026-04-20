"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

export type RequirementsComposerToolsMenu = {
  readonly onOrganizeRequirements: () => void;
  readonly organizeDisabled: boolean;
  readonly draftViewAvailable: boolean;
  readonly onOpenDraftView: () => void;
  readonly onOpenPromptView: () => void;
  readonly onOpenSummaryEdit: () => void;
};

const MENU_Z = 72;

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function menuItemStyle(disabled: boolean): CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "11px 14px",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    fontSize: 14,
    fontWeight: 600,
    color: disabled ? "#94a3b8" : "#0f172a",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function ToolsMenuItems({
  tools,
  onPick,
}: {
  readonly tools: RequirementsComposerToolsMenu;
  readonly onPick: () => void;
}) {
  return (
    <>
      <button
        type="button"
        role="menuitem"
        disabled={tools.organizeDisabled}
        onClick={() => {
          if (tools.organizeDisabled) return;
          tools.onOrganizeRequirements();
          onPick();
        }}
        style={menuItemStyle(tools.organizeDisabled)}
      >
        정리 요청
      </button>
      {tools.draftViewAvailable ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            tools.onOpenDraftView();
            onPick();
          }}
          style={menuItemStyle(false)}
        >
          정리본 보기
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          tools.onOpenPromptView();
          onPick();
        }}
        style={menuItemStyle(false)}
      >
        프롬프트 보기
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          tools.onOpenSummaryEdit();
          onPick();
        }}
        style={menuItemStyle(false)}
      >
        요약 편집
      </button>
    </>
  );
}

export function RequirementsComposerGpt({
  value,
  onChange,
  onSend,
  busy,
  disabled,
  placeholder,
  toolsMenu,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly onSend: () => void;
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  /** + 메뉴(정리 요청 등). 없으면 + 버튼 미표시 */
  readonly toolsMenu?: RequirementsComposerToolsMenu;
}) {
  const showScreenLabels = useShowScreenLabels();
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const menuId = useId();

  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 220;
    el.style.height = `${Math.min(max, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [value, autoGrow]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    const onChange = () => {
      apply();
      setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || narrow) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (plusRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen, narrow]);

  useEffect(() => {
    if (!menuOpen) return;
    const t = window.setTimeout(() => {
      const root = narrow ? sheetRef.current : popoverRef.current;
      const first = root?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])');
      first?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [menuOpen, narrow]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #e2e8f0",
        background: "#fff",
        boxShadow: "0 10px 40px -18px rgba(15, 23, 42, 0.18)",
        padding: "12px 14px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {toolsMenu ? (
          <div className="relative" style={{ position: "relative", flexShrink: 0 }}>
            <ScreenLabel label="요구사항-입력창-액션행" visible={showScreenLabels} />
            <button
              ref={plusRef}
              type="button"
              data-testid="requirements-composer-tools-trigger"
              aria-label="도구 메뉴 열기"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                background: "#fafafa",
                color: "#475569",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
              }}
            >
              <PlusIcon />
            </button>
            {menuOpen && !narrow ? (
              <div
                ref={popoverRef}
                id={menuId}
                role="menu"
                aria-label="입력 도구"
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: 0,
                  minWidth: 216,
                  padding: 6,
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  boxShadow: "0 12px 40px -12px rgba(15, 23, 42, 0.2)",
                  zIndex: MENU_Z,
                }}
              >
                <ToolsMenuItems tools={toolsMenu} onPick={closeMenu} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="relative" style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <ScreenLabel label="요구사항-채팅영역-입력창" visible={showScreenLabels} />
          <textarea
            ref={taRef}
            data-testid="requirements-chat-input"
            value={value}
            disabled={disabled}
            rows={1}
            onChange={(e) => onChange(e.target.value)}
            onInput={autoGrow}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={placeholder ?? "무엇을 만들고 싶은지 입력하세요"}
            style={{
              width: "100%",
              boxSizing: "border-box",
              flex: 1,
              minHeight: 44,
              maxHeight: 220,
              resize: "none",
              border: "none",
              outline: "none",
              background: "#f4f4f5",
              borderRadius: 14,
              fontSize: 16,
              lineHeight: 1.5,
              fontFamily: "inherit",
              padding: "12px 14px",
            }}
          />
        </div>
        <div className="relative" style={{ position: "relative", flex: "0 0 auto" }}>
          <ScreenLabel label="요구사항-채팅영역-전송버튼" visible={showScreenLabels} />
          <button
            type="button"
            disabled={busy || disabled}
            title="전송"
            aria-label="전송"
            onClick={onSend}
            style={{
              flex: "0 0 auto",
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "none",
              background: busy || disabled ? "#cbd5e1" : "linear-gradient(180deg, #0f766e 0%, #0d5c56 100%)",
              color: "#fff",
              cursor: busy || disabled ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              lineHeight: 1,
              boxShadow: busy || disabled ? "none" : "0 8px 20px -6px rgba(13, 92, 86, 0.45)",
            }}
          >
            ➤
          </button>
        </div>
      </div>

      {menuOpen && narrow && toolsMenu ? (
        <>
          <button
            type="button"
            aria-label="메뉴 닫기"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: MENU_Z,
              border: 0,
              padding: 0,
              margin: 0,
              background: "rgba(15, 23, 42, 0.35)",
              cursor: "pointer",
            }}
            onClick={closeMenu}
          />
          <div
            ref={sheetRef}
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="입력 도구"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: MENU_Z + 1,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderTop: "1px solid #e2e8f0",
              background: "#fff",
              padding: "10px 12px 20px",
              boxShadow: "0 -8px 32px rgba(15, 23, 42, 0.12)",
              maxHeight: "min(70vh, 420px)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 999,
                background: "#e2e8f0",
                margin: "4px auto 12px",
              }}
              aria-hidden
            />
            <div role="menu" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <ToolsMenuItems tools={toolsMenu} onPick={closeMenu} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
