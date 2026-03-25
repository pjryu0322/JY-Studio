"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { subscribe, readUiLabelsEnabled } from "@/lib/ui-label/useUiLabel";
import {
  DEBUG_LABEL_BADGE_BASE_STYLE,
  DEBUG_LABEL_OVERLAY_ROOT_STYLE,
} from "@/components/debug/debugLabelLayerStyles";

type LabelItem = {
  key: string;
  text: string;
  top: number;
  left: number;
};

export default function UiLabelOverlay() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const rafRef = useRef<number | null>(null);

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

  if (!show) {
    return null;
  }

  return (
    <div aria-hidden data-ui-label-overlay-root style={DEBUG_LABEL_OVERLAY_ROOT_STYLE}>
      {labels.map((l) => (
        <div
          key={l.key}
          style={{
            ...DEBUG_LABEL_BADGE_BASE_STYLE,
            top: l.top,
            left: l.left,
          }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}
