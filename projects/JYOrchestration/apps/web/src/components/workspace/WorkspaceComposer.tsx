"use client";

import type { MutableRefObject, ReactNode } from "react";
import styles from "@/components/workspace/workspaceComposer.module.css";

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** 전송 버튼용 종이비행기 아이콘(채팅 composer 공통) */
export function WorkspaceComposerSendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

/** 채팅 composer 세로 스택(하단 고정 영역 내부). */
export function WorkspaceComposerColumn({ children }: { readonly children: ReactNode }) {
  return <div className={styles.column}>{children}</div>;
}

/** 둥근 입력 허브 한 줄(+ · 입력 · 전송 자리). */
export function WorkspaceComposerHubRow({ children }: { readonly children: ReactNode }) {
  return <div className={styles.hubRow}>{children}</div>;
}

export function WorkspaceComposerLeadingSlot({ children }: { readonly children: ReactNode }) {
  return <div className={styles.leading}>{children}</div>;
}

export function WorkspaceComposerInputColumn({ children }: { readonly children: ReactNode }) {
  return <div className={styles.inputCol}>{children}</div>;
}

export function WorkspaceComposerTrailingSlot({ children }: { readonly children: ReactNode }) {
  return <div className={styles.trailing}>{children}</div>;
}

export function WorkspaceComposerPlusTrigger({
  onClick,
  plusRef,
  menuOpen,
  menuId,
  testId = "requirements-composer-tools-trigger",
}: {
  readonly onClick: () => void;
  readonly plusRef: MutableRefObject<HTMLButtonElement | null>;
  readonly menuOpen: boolean;
  readonly menuId: string;
  readonly testId?: string;
}) {
  return (
    <button
      ref={plusRef}
      type="button"
      data-testid={testId}
      aria-label="도구 메뉴 열기"
      aria-haspopup="true"
      aria-expanded={menuOpen}
      aria-controls={menuOpen ? menuId : undefined}
      onClick={onClick}
      className={styles.plusBtn}
    >
      <PlusIcon />
    </button>
  );
}

export function workspaceComposerTextareaClassName(): string {
  return styles.textarea;
}

export function workspaceComposerSendClassName(disabled: boolean): string {
  return `${styles.sendBtn} ${disabled ? styles.sendBtnDisabled : styles.sendBtnActive}`;
}
