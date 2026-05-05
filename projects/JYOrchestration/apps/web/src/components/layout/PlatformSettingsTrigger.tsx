"use client";

import { useRef } from "react";
import { toggleSettingsPanel } from "@/lib/settings/settingsPanelStore";
import { useSettingsPanelStore } from "@/lib/settings/useSettingsPanelStore";

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V4a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

/** 상단 헤더 전용: 전역 `SettingsPanel`을 연다(패널 본문은 `TopRightToolbar`에서 단일 마운트). */
export function PlatformSettingsTrigger() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const { open } = useSettingsPanelStore();

  return (
    <button
      ref={btnRef}
      type="button"
      data-jyo-settings-trigger
      onClick={() => toggleSettingsPanel({ anchorEl: btnRef.current })}
      aria-label="설정"
      aria-haspopup="dialog"
      aria-expanded={open}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        padding: 0,
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: open ? "#f1f5f9" : "#fff",
        color: "#475569",
        cursor: "pointer",
      }}
    >
      <GearIcon />
    </button>
  );
}
