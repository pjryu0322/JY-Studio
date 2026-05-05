"use client";

import type { ReactNode } from "react";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import styles from "@/components/workspace/chatWindowScreenLabelBoundaries.module.css";

/** 설정「화면 라벨 표시」— 대화창 상단 경계(고정 헤더 영역 안에 배치) */
export function ChatWindowScreenLabelTop(): ReactNode {
  const show = useShowScreenLabels();
  if (!show) return null;
  return (
    <div className={styles.strip} data-testid="chat-window-screen-label-top" role="note">
      대화창 영역 상단
    </div>
  );
}

/** 설정「화면 라벨 표시」— 대화창 하단 경계(고정 입력 영역 안에 배치) */
export function ChatWindowScreenLabelBottom(): ReactNode {
  const show = useShowScreenLabels();
  if (!show) return null;
  return (
    <div className={styles.strip} data-testid="chat-window-screen-label-bottom" role="note">
      대화창 영역 하단
    </div>
  );
}
