"use client";

import type { ReactNode } from "react";
import styles from "@/components/preview/implementationStageGlobalToolbar.module.css";

export function ImplementationStageGlobalToolbar({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <div
      className={styles.root}
      data-testid="implementation-stage-global-toolbar"
      role="toolbar"
      aria-label="구현단계 전역 도구"
    >
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
