"use client";

import { useEffect, type ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import styles from "./featurePlanningWorkspace.module.css";

export function FeaturePlanningWorkspaceCanvas({
  title,
  onClose,
  children,
  footer,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.canvasRoot}>
      <button
        type="button"
        className={styles.canvasBackdrop}
        aria-label="캔버스 닫기"
        onClick={onClose}
        style={{ background: t.overlayScrim }}
      />
      <div className={styles.canvasPanel} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.canvasHeader}>
          <h2 className={styles.canvasTitle}>{title}</h2>
          <button
            type="button"
            className={styles.canvasClose}
            onClick={onClose}
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "8px 12px",
              borderRadius: t.radiusMd,
              border: `1px solid ${t.border}`,
              background: t.bgCard,
              color: t.textPrimary,
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </header>
        <div className={styles.canvasBody}>{children}</div>
        {footer ? <footer className={styles.canvasFooter}>{footer}</footer> : null}
      </div>
    </div>
  );
}
