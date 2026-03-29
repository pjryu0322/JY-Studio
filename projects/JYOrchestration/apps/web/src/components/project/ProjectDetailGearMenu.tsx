"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { readUiLabelsEnabled, subscribe, writeUiLabelsEnabled } from "@/lib/ui-label/useUiLabel";

const LS_VERBOSE = "jy_dev_verbose_logs";
const LS_DEBUG_MODE = "jy_dev_debug_mode";
const LS_RETRY_POLICY = "jy_dev_retry_policy";
const LS_TIMEOUT_SCALE = "jy_dev_timeout_scale";
const LS_FLAG_EXPERIMENTAL_UI = "jy_feature_experimental_ui";

function readLsBool(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeLsBool(key: string, v: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, v ? "true" : "false");
  } catch {
    /* ignore */
  }
}

function readLsString(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLsString(key: string, v: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

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
 * 프로젝트 상세 상단 우측 톱니바퀴 — 표시/개발자/고급 옵션(로컬 저장).
 * 실행 환경 탭 본문은 여기에 넣지 않습니다.
 */
export function ProjectDetailGearMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [labelsOn, setLabelsOn] = useState(false);
  const [verboseLogs, setVerboseLogs] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [retryPolicy, setRetryPolicy] = useState("default");
  const [timeoutScale, setTimeoutScale] = useState("1");
  const [experimentalUi, setExperimentalUi] = useState(false);

  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      setLabelsOn(readUiLabelsEnabled());
      setVerboseLogs(readLsBool(LS_VERBOSE));
      setDebugMode(readLsBool(LS_DEBUG_MODE));
      setRetryPolicy(readLsString(LS_RETRY_POLICY, "default"));
      setTimeoutScale(readLsString(LS_TIMEOUT_SCALE, "1"));
      setExperimentalUi(readLsBool(LS_FLAG_EXPERIMENTAL_UI));
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
        aria-label="프로젝트 표시 및 개발자 설정"
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

          <div style={sectionTitle}>Display</div>
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

          <div style={sectionTitle}>Developer Options</div>
          <label style={labelRow}>
            <input
              type="checkbox"
              checked={verboseLogs}
              onChange={(e) => {
                const next = e.target.checked;
                setVerboseLogs(next);
                writeLsBool(LS_VERBOSE, next);
              }}
              style={{ width: 16, height: 16, accentColor: "#2563eb" }}
            />
            <span>로그 상세 보기</span>
          </label>
          <label style={labelRow}>
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => {
                const next = e.target.checked;
                setDebugMode(next);
                writeLsBool(LS_DEBUG_MODE, next);
              }}
              style={{ width: 16, height: 16, accentColor: "#2563eb" }}
            />
            <span>디버그 모드</span>
          </label>

          <div style={sectionTitle}>Advanced Settings</div>
          <label style={{ display: "grid", gap: 4, marginBottom: 10, fontSize: 12, color: "#334155" }}>
            <span style={{ fontWeight: 600 }}>retry 정책 (클라이언트 힌트)</span>
            <select
              value={retryPolicy}
              onChange={(e) => {
                const v = e.target.value;
                setRetryPolicy(v);
                writeLsString(LS_RETRY_POLICY, v);
              }}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}
            >
              <option value="default">기본</option>
              <option value="conservative">보수적 (재시도 적음)</option>
              <option value="aggressive">공격적 (재시도 많음)</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, marginBottom: 10, fontSize: 12, color: "#334155" }}>
            <span style={{ fontWeight: 600 }}>timeout 배율 (클라이언트 힌트)</span>
            <select
              value={timeoutScale}
              onChange={(e) => {
                const v = e.target.value;
                setTimeoutScale(v);
                writeLsString(LS_TIMEOUT_SCALE, v);
              }}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}
            >
              <option value="1">1×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
          </label>
          <label style={labelRow}>
            <input
              type="checkbox"
              checked={experimentalUi}
              onChange={(e) => {
                const next = e.target.checked;
                setExperimentalUi(next);
                writeLsBool(LS_FLAG_EXPERIMENTAL_UI, next);
              }}
              style={{ width: 16, height: 16, accentColor: "#2563eb" }}
            />
            <span>Feature: 실험 UI 플래그</span>
          </label>
          <p style={{ margin: "10px 0 0 0", fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>
            고급 항목은 추후 API·워커와 연동할 수 있도록 로컬에만 저장됩니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
