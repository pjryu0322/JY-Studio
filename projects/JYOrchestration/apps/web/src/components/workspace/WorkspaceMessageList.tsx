"use client";

import type { ReactNode, Ref } from "react";
import styles from "@/components/workspace/workspaceMessageList.module.css";

export function WorkspaceMessageList({
  children,
  scrollRootRef,
  endRef,
  beforeMessages,
}: {
  readonly children: ReactNode;
  /** 스크롤 컨테이너(선택) */
  readonly scrollRootRef?: Ref<HTMLDivElement>;
  /** 스크롤 끝 앵커 */
  readonly endRef?: Ref<HTMLDivElement>;
  /** 타임라인 위 라벨 등 */
  readonly beforeMessages?: ReactNode;
}) {
  return (
    <div ref={scrollRootRef} className={styles.scroll}>
      {beforeMessages}
      <div className={styles.inner}>
        {children}
        <div ref={endRef} className={styles.endAnchor} aria-hidden />
      </div>
    </div>
  );
}
