"use client";

import { useEffect, useRef, useState } from "react";
import { readUiLabelsEnabled, writeUiLabelsEnabled, subscribe } from "@/lib/ui-label/useUiLabel";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

export default function DebugSettings() {
  const showScreenLabels = useShowScreenLabels();
  const [open, setOpen] = useState(false);
  const [labelsOn, setLabelsOn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    queueMicrotask(() => {
      setMounted(true);
      setLabelsOn(readUiLabelsEnabled());
    });
    const syncFromStorage = () => setLabelsOn(readUiLabelsEnabled());
    const off = subscribe(syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      off();
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 2147483647,
        pointerEvents: "none",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{ pointerEvents: "auto", position: "relative", paddingTop: showScreenLabels ? 22 : 0 }}
        className="relative"
      >
        <ScreenLabel label="공통-상단바-화면설정-버튼" visible={showScreenLabels} />
        <button
          ref={btnRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="화면 표시 설정"
          onClick={() => setOpen((v) => !v)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#334155",
          }}
        >
          ⚙
        </button>

        {open ? (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="화면 표시 설정"
            className="relative"
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 8,
              padding: showScreenLabels ? "26px 14px 12px 14px" : "12px 14px",
              minWidth: 220,
              maxWidth: "min(280px, calc(100vw - 32px))",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              boxShadow: "0 10px 40px rgba(15,23,42,0.12)",
            }}
          >
            <ScreenLabel label="공통-상단바-화면설정-팝오버" visible={showScreenLabels} />
            <div className="relative" style={{ margin: "0 0 10px 0" }}>
              <ScreenLabel label="공통-상단바-화면설정-표시섹션" visible={showScreenLabels} />
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#64748b" }}>표시</p>
            </div>
            <label
              className="relative"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                fontSize: 13,
                color: "#0f172a",
                userSelect: "none",
              }}
            >
              <ScreenLabel label="공통-상단바-화면설정-화면라벨표시-체크박스" visible={showScreenLabels} />
              <input
                type="checkbox"
                checked={labelsOn}
                onChange={(e) => {
                  const next = e.target.checked;
                  setLabelsOn(next);
                  writeUiLabelsEnabled(next);
                }}
                style={{ width: 16, height: 16, accentColor: "#2563eb" }}
              />
              <span>화면 라벨 표시</span>
            </label>
            <p style={{ margin: "10px 0 0 0", fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
              상태는 이 브라우저에만 저장됩니다.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
