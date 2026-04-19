"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { readUiLabelsEnabled, subscribe, writeUiLabelsEnabled } from "@/lib/ui-label/useUiLabel";

const sectionTitle: CSSProperties = {
  margin: "12px 0 8px 0",
  fontSize: 11,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const labelRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  fontSize: 13,
  color: "#0f172a",
  userSelect: "none",
  marginBottom: 8,
};

/**
 * 프로젝트 상세 상단 우측 톱니바퀴 — 표시 옵션(로컬 저장).
 * 실행 환경 본문은「실행 환경」탭에서 구성합니다.
 */
export function ProjectDetailGearMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [labelsOn, setLabelsOn] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      setLabelsOn(readUiLabelsEnabled());
    });
    const off = subscribe(() => setLabelsOn(readUiLabelsEnabled()));
    return () => off();
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

  if (!mounted) return null;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        data-testid="project-detail-gear-menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="프로젝트 표시 설정"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: open ? "1px solid #2563eb" : "1px solid #ccc",
          background: open ? "#eff6ff" : "#fafafa",
          cursor: "pointer",
          fontSize: 20,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: open ? "#1e40af" : "#334155",
        }}
      >
        ⚙️
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="프로젝트 설정"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            padding: "14px 16px",
            minWidth: 280,
            maxWidth: "min(360px, calc(100vw - 48px))",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(15,23,42,0.12)",
            zIndex: 50,
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>설정</p>
          <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
            이 브라우저에만 저장됩니다. 실행 환경(Cursor·Git 검증)은「실행 환경」탭에서 구성합니다.
          </p>

          <div style={sectionTitle}>표시</div>
          <label style={labelRow}>
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
        </div>
      ) : null}
    </div>
  );
}
