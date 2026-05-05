"use client";

import type { ReactNode } from "react";
import { ChatWindowScreenLabelBottom, ChatWindowScreenLabelTop } from "@/components/workspace/ChatWindowScreenLabelBoundaries";
import styles from "@/components/workspace/workspaceShell.module.css";

/**
 * 채팅형 단일 작업공간: 상단(선택) · 본문(스크롤) · 하단 고정(composer).
 * 3분할 레이아웃은 `WorkspaceSplitShell`을 사용합니다.
 */
export function WorkspaceShell({
  top,
  children,
  footer,
  className,
  "data-testid": dataTestId,
}: {
  readonly top?: ReactNode;
  readonly children: ReactNode;
  readonly footer: ReactNode;
  readonly className?: string;
  readonly "data-testid"?: string;
}) {
  return (
    <div
      data-testid={dataTestId}
      className={["chat-viewport", className].filter(Boolean).join(" ")}
      role="region"
      aria-label="워크스페이스"
    >
      <div className="chat-header">
        <ChatWindowScreenLabelTop />
        {top ? <div className={styles.top}>{top}</div> : null}
      </div>
      {children}
      <div className="chat-input">
        <ChatWindowScreenLabelBottom />
        <div className={styles.footer}>{footer}</div>
      </div>
    </div>
  );
}
