"use client";

import type { ReactNode } from "react";
import styles from "@/components/workspace/workspacePlusMenu.module.css";

export type WorkspacePlusMenuTools = {
  readonly onOrganizeRequirements: () => void;
  readonly organizeDisabled: boolean;
  readonly draftViewAvailable: boolean;
  readonly onOpenDraftView: () => void;
  readonly organizeMenuTitle?: string;
  readonly draftMenuTitle?: string;
};

function MenuItemText({ title, sub }: { readonly title: string; readonly sub?: string }) {
  return (
    <span className={styles.stack}>
      <span className={styles.title}>{title}</span>
      {sub ? <span className={styles.sub}>{sub}</span> : null}
    </span>
  );
}

/** + 메뉴 항목(정리 요청·정리본 보기 등). 단계별 항목은 이후 확장. */
export function WorkspacePlusMenuItems({ tools, onPick }: { readonly tools: WorkspacePlusMenuTools; readonly onPick: () => void }) {
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
        className={styles.item}
      >
        <MenuItemText title={tools.organizeMenuTitle?.trim() || "정리 요청"} />
      </button>
      {tools.draftViewAvailable ? <div className={styles.divider} aria-hidden /> : null}
      {tools.draftViewAvailable ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            tools.onOpenDraftView();
            onPick();
          }}
          className={styles.item}
        >
          <MenuItemText title={tools.draftMenuTitle?.trim() || "정리본 보기"} />
        </button>
      ) : null}
    </>
  );
}

export function WorkspacePlusMenuDivider(): ReactNode {
  return <div className={styles.divider} aria-hidden />;
}
