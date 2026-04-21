"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useUiLabel } from "@/lib/ui-label/useUiLabel";
import { AI_RESPONSE_STYLE_LABELS, type AiResponseStyle } from "@/lib/preferences/globalPreferences";
import { useGlobalPreferences } from "@/lib/preferences/useGlobalPreferences";

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V4a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function sectionTitle(text: string, opts?: { first?: boolean }) {
  return (
    <p
      style={{
        margin: opts?.first ? "0 0 8px 0" : "14px 0 8px 0",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        color: "#94a3b8",
        textTransform: "uppercase",
      }}
    >
      {text}
    </p>
  );
}

function row(label: string, control: ReactNode) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 36,
        padding: "4px 0",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", flex: "1 1 auto", minWidth: 0 }}>{label}</span>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}

export function PlatformSettingsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { enabled, setEnabled, ready } = useUiLabel();
  const prefs = useGlobalPreferences();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = (await res.json()) as { success?: boolean; data?: { isPlatformAdmin?: boolean } | null };
        if (!cancelled) setIsPlatformAdmin(Boolean(json.success && json.data?.isPlatformAdmin));
      } catch {
        if (!cancelled) setIsPlatformAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const styleButtons = (keys: AiResponseStyle[]) =>
    keys.map((k) => {
      const active = prefs.aiResponseStyle === k;
      return (
        <button
          key={k}
          type="button"
          onClick={() => prefs.setAiResponseStyle(k)}
          style={{
            padding: "5px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            border: active ? "1px solid #2563eb" : "1px solid #e2e8f0",
            background: active ? "#eff6ff" : "#fff",
            color: active ? "#1d4ed8" : "#64748b",
            cursor: "pointer",
          }}
        >
          {AI_RESPONSE_STYLE_LABELS[k]}
        </button>
      );
    });

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
            width: "min(92vw, 300px)",
            maxHeight: "min(70vh, 520px)",
            overflowY: "auto",
            padding: "12px 14px 14px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            boxShadow: "0 10px 40px rgba(15, 23, 42, 0.12)",
            zIndex: 50,
          }}
        >
          <p style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 800, color: "#0f172a" }}>설정</p>
          <p style={{ margin: "0 0 10px 0", fontSize: 11, color: "#94a3b8" }}>이 기기에만 저장됩니다.</p>

          {sectionTitle("화면", { first: true })}
          {row(
            "화면 라벨 표시",
            <input
              type="checkbox"
              checked={ready ? enabled : false}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
            />
          )}
          {row(
            "컴팩트 모드",
            <input
              type="checkbox"
              checked={prefs.compactMode}
              onChange={(e) => prefs.setCompactMode(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
            />
          )}
          {row(
            "애니메이션 최소화",
            <input
              type="checkbox"
              checked={prefs.reduceMotion}
              onChange={(e) => prefs.setReduceMotion(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
            />
          )}

          {sectionTitle("작업")}
          {row(
            "최근 프로젝트 자동 열기",
            <input
              type="checkbox"
              checked={prefs.autoOpenLastProject}
              onChange={(e) => prefs.setAutoOpenLastProject(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
            />
          )}

          {sectionTitle("AI")}
          {row(
            "AI 기획자 자동 참여",
            <input
              type="checkbox"
              checked={prefs.aiFacilitatorAutoJoin}
              onChange={(e) => prefs.setAiFacilitatorAutoJoin(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
            />
          )}
          <div style={{ padding: "6px 0 8px 0", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 8 }}>응답 스타일</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{styleButtons(["brief", "standard", "detailed"])}</div>
          </div>

          {isPlatformAdmin ? (
            <>
              {sectionTitle("고급")}
              {row(
                "개발 패널 표시",
                <input
                  type="checkbox"
                  checked={prefs.devPanelVisible}
                  onChange={(e) => prefs.setDevPanelVisible(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
                />
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
