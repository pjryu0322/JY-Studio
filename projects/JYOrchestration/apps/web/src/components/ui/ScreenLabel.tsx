"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScreenLabelProps = {
  label: string;
  visible: boolean;
};

function CopyIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={`pointer-events-none ${className ?? ""}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function ScreenLabel({ label, visible }: ScreenLabelProps) {
  const [copied, setCopied] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const copy = useCallback(async () => {
    const text = label;
    let ok = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (!ok) return;
    setCopied(true);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setCopied(false), 1000);
  }, [label]);

  if (!visible) return null;

  return (
    <span
      className="ui-screen-label group inline-flex max-w-[calc(100%-12px)] cursor-pointer items-center gap-1"
      onClick={() => void copy()}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <button
        type="button"
        className="ui-screen-label-copy shrink-0 cursor-pointer border-0 bg-transparent p-0 text-current opacity-60 transition-opacity hover:opacity-100 group-hover:opacity-100"
        aria-label={copied ? "복사됨" : "라벨 텍스트 복사"}
        title={copied ? "복사됨" : "클릭하여 복사"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void copy();
        }}
      >
        {copied ? <span className="whitespace-nowrap text-[10px] font-bold leading-none">복사됨</span> : <CopyIcon />}
      </button>
    </span>
  );
}
