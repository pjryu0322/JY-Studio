"use client";

import { useEffect, useRef, useState } from "react";
import { useUiLabel } from "@/lib/ui-label/useUiLabel";

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V4a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function PlatformSettingsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { enabled, setEnabled, ready } = useUiLabel();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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
      {open ? (
        <div
          role="dialog"
          aria-label="설정"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            minWidth: 240,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            boxShadow: "0 10px 40px rgba(15, 23, 42, 0.12)",
            zIndex: 50,
          }}
        >
          <p style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>설정</p>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <span>화면 라벨 표시</span>
            <input
              type="checkbox"
              checked={ready ? enabled : false}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
