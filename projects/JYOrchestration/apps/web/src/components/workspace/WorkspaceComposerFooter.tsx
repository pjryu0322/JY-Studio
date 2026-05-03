"use client";

import type { ReactNode } from "react";
import styles from "@/components/workspace/workspaceComposerFooter.module.css";

/** 채팅 하단 composer 고정 래퍼(배경·구분선·패딩). */
export function WorkspaceComposerFooter({ children }: { readonly children: ReactNode }) {
  return <div className={styles.footer}>{children}</div>;
}
