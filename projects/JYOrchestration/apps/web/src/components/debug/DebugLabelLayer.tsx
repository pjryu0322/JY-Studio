"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Label = {
  key: string;
  text: string;
  top: number;
  left: number;
};

function isDebugLabelEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEBUG_LABEL === "true"
  );
}

export default function DebugLabelLayer() {
  const pathname = usePathname();
  const [labels, setLabels] = useState<Label[]>([]);
  const rafRef = useRef<number | null>(null);

  const collect = useCallback(() => {
    if (typeof document === "undefined") return;

    const nodes = document.querySelectorAll("[data-debug-label]");
    const next: Label[] = [];

    nodes.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const text = el.getAttribute("data-debug-label")?.trim() ?? "";

      if (rect.width > 0 && rect.height > 0 && text) {
        next.push({
          key: `dbg-label-${index}`,
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
    if (!isDebugLabelEnabled()) return;

    scheduleCollect();

    window.addEventListener("scroll", scheduleCollect, true);
    window.addEventListener("resize", scheduleCollect);

    const observer = new MutationObserver(() => scheduleCollect());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-debug-label"],
    });

    return () => {
      window.removeEventListener("scroll", scheduleCollect, true);
      window.removeEventListener("resize", scheduleCollect);
      observer.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [pathname, scheduleCollect]);

  if (!isDebugLabelEnabled()) {
    return null;
  }

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2147483000 }}>
      {labels.map((l) => (
        <div
          key={l.key}
          style={{
            position: "fixed",
            top: l.top,
            left: l.left,
            background: "rgba(255,0,0,0.85)",
            color: "#fff",
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 4,
            zIndex: 2147483646,
            pointerEvents: "none",
            maxWidth: "min(280px, 90vw)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}
