"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LabelTagProps = {
  label: string;
  className?: string;
};

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function LabelTag({ label, className }: LabelTagProps) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2200);
  }, []);

  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(label);
    if (ok) {
      showToast(`라벨 복사됨: ${label}`);
    } else {
      showToast("복사에 실패했습니다.");
    }
  }, [label, showToast]);

  return (
    <>
      <div
        data-label-tag-root
        data-ui-label={label}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          position: "relative",
          fontSize: 11,
          fontWeight: 700,
          color: "#dc2626",
          letterSpacing: "0.02em",
          userSelect: "none",
        }}
      >
        <span style={{ fontFamily: "ui-monospace, monospace" }}>{label}</span>
        <button
          type="button"
          aria-label={`라벨 복사: ${label}`}
          onClick={() => void onCopy()}
          className="label-tag-copy-btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 28,
            minHeight: 28,
            padding: 4,
            margin: 0,
            border: "1px solid #fecaca",
            borderRadius: 6,
            background: "#fff",
            color: "#b91c1c",
            cursor: "pointer",
            opacity: 0,
            transition: "opacity 0.15s ease",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.5L14.5 4H10a2 2 0 00-2 2z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M14 4v4h4M6 8H5a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <style>{`
        [data-label-tag-root]:hover .label-tag-copy-btn {
          opacity: 1;
        }
      `}</style>
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            padding: "10px 16px",
            borderRadius: 8,
            background: "#1e293b",
            color: "#f8fafc",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            maxWidth: "min(90vw, 480px)",
            wordBreak: "break-word",
          }}
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
