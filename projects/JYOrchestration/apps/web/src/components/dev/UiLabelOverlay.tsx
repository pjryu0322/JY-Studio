"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { subscribe, readUiLabelsEnabled } from "@/lib/ui-label/useUiLabel";
import {
  DEBUG_LABEL_BADGE_ROW_STYLE,
  DEBUG_LABEL_BADGE_TEXT_STYLE,
  DEBUG_LABEL_COPY_BUTTON_STYLE,
  DEBUG_LABEL_OVERLAY_ROOT_STYLE,
} from "@/components/debug/debugLabelLayerStyles";

type LabelItem = {
  key: string;
  text: string;
  top: number;
  left: number;
};

async function copyLabelToClipboard(text: string): Promise<boolean> {
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
  } catch (e) {
    console.error("UiLabelOverlay: clipboard copy failed", e);
    return false;
  }
}

export default function UiLabelOverlay() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sync = () => setShow(readUiLabelsEnabled());
    sync();
    window.addEventListener("storage", sync);
    const off = subscribe(sync);
    return () => {
      window.removeEventListener("storage", sync);
      off();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 1600);
  }, []);

  const collect = useCallback(() => {
    if (typeof document === "undefined") return;

    const nodes = document.querySelectorAll("[data-ui-label]");
    const next: LabelItem[] = [];

    nodes.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const text = el.getAttribute("data-ui-label")?.trim() ?? "";

      if (rect.width > 0 && rect.height > 0 && text) {
        next.push({
          key: `ui-label-${index}-${text.slice(0, 24)}`,
          text,
          top: rect.top,
          left: rect.left,
        });
      }
    });

    setLabels(next);
  }, []);

  const scheduleCollect = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      collect();
    });
  }, [collect]);

  useEffect(() => {
    if (!show) {
      void Promise.resolve().then(() => setLabels([]));
      return;
    }

    scheduleCollect();

    window.addEventListener("scroll", scheduleCollect, true);
    window.addEventListener("resize", scheduleCollect);

    const observer = new MutationObserver(() => scheduleCollect());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-ui-label", "class", "style"],
    });

    return () => {
      window.removeEventListener("scroll", scheduleCollect, true);
      window.removeEventListener("resize", scheduleCollect);
      observer.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [show, pathname, scheduleCollect]);

  const onCopyClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>, text: string) => {
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        const ok = await copyLabelToClipboard(text);
        if (ok) {
          showToast("복사됨");
        } else {
          showToast("복사 실패");
        }
      })();
    },
    [showToast]
  );

  if (!show) {
    return null;
  }

  return (
    <>
      <div
        role="region"
        aria-label="UI 라벨 오버레이"
        data-ui-label-overlay-root
        style={DEBUG_LABEL_OVERLAY_ROOT_STYLE}
      >
        {labels.map((l) => (
          <div
            key={l.key}
            style={{
              ...DEBUG_LABEL_BADGE_ROW_STYLE,
              top: l.top,
              left: l.left,
            }}
          >
            <span style={DEBUG_LABEL_BADGE_TEXT_STYLE} title={l.text}>
              {l.text}
            </span>
            <button
              type="button"
              aria-label="라벨 복사"
              title="라벨 복사"
              style={{ ...DEBUG_LABEL_COPY_BUTTON_STYLE, transition: "background 0.12s ease, transform 0.12s ease" }}
              onClick={(e) => onCopyClick(e, l.text)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0,0,0,0.55)";
                e.currentTarget.style.transform = "scale(1.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0,0,0,0.35)";
                e.currentTarget.style.transform = "scale(1)";
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = "2px solid #fff";
                e.currentTarget.style.outlineOffset = "2px";
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
                e.currentTarget.style.outlineOffset = "0";
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
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
        ))}
      </div>
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2147483647,
            padding: "8px 14px",
            borderRadius: 8,
            background: "#1e293b",
            color: "#f8fafc",
            fontSize: 13,
            fontWeight: 600,
            pointerEvents: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
