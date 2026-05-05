"use client";

import { type CSSProperties } from "react";
import { useLayoutMobileBreakpoint } from "@/components/ui/breakpoints";
import { SettingsPanelBody } from "@/components/layout/SettingsPanelBody";

function shellStyle(narrow: boolean): CSSProperties {
  return {
    flex: "1 1 auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    width: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    background: "#fff",
    border: narrow ? undefined : "1px solid #e2e8f0",
    borderRadius: narrow ? 0 : 12,
    maxWidth: narrow ? "100%" : 720,
    margin: narrow ? 0 : "0 auto",
  };
}

export function SettingsPageClient() {
  const narrow = useLayoutMobileBreakpoint();

  return (
    <main
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        boxSizing: "border-box",
        padding: narrow ? "8px max(10px, env(safe-area-inset-left)) max(12px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-right))" : 24,
      }}
    >
      <div style={{ ...shellStyle(narrow), flex: "1 1 auto", minHeight: 0 }}>
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: narrow ? "12px 14px 10px" : "14px 18px 12px",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <span aria-hidden />
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            padding: narrow ? "10px 14px 16px" : "14px 18px 20px",
          }}
        >
          <SettingsPanelBody />
        </div>
      </div>
    </main>
  );
}
