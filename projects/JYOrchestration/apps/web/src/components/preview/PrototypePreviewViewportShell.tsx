"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type {
  PrototypePreviewMobileDevice,
  PrototypePreviewWorkMode,
} from "@/lib/preferences/prototypePreviewViewport";
import { PROTOTYPE_PREVIEW_PRESETS } from "@/lib/preferences/prototypePreviewViewport";
import { uiTokens as t } from "@/components/ui/tokens";

function logicalViewportPx(
  workMode: PrototypePreviewWorkMode,
  mobileDevice: PrototypePreviewMobileDevice,
  rotationLandscape: boolean,
): { width: number; height: number } | null {
  if (workMode === "auto") return null;
  if (workMode === "desktop") {
    const { width: w, height: h } = PROTOTYPE_PREVIEW_PRESETS.desktop;
    return rotationLandscape ? { width: h, height: w } : { width: w, height: h };
  }
  const preset = mobileDevice === "android" ? PROTOTYPE_PREVIEW_PRESETS.android : PROTOTYPE_PREVIEW_PRESETS.iphone;
  const { width: w, height: h } = preset;
  return rotationLandscape ? { width: h, height: w } : { width: w, height: h };
}

export function PrototypePreviewViewportShell(p: {
  readonly workMode: PrototypePreviewWorkMode;
  readonly mobileDevice: PrototypePreviewMobileDevice;
  readonly rotationLandscape: boolean;
  readonly children: ReactNode;
}): ReactNode {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({ w: Math.max(0, r.width), h: Math.max(0, r.height) });
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, p.workMode, p.mobileDevice, p.rotationLandscape]);

  const logical = useMemo(
    () => logicalViewportPx(p.workMode, p.mobileDevice, p.rotationLandscape),
    [p.workMode, p.mobileDevice, p.rotationLandscape],
  );

  const scale = useMemo(() => {
    if (!logical || box.w <= 0 || box.h <= 0) return 1;
    return Math.min(1, box.w / logical.width, box.h / logical.height);
  }, [logical, box.w, box.h]);

  const isAuto = p.workMode === "auto";
  const isMobileFrame = p.workMode === "mobile";

  const wrapStyle: CSSProperties = {
    position: "relative",
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  const breakpointBadge =
    isAuto && box.w > 0 ? (
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 3,
          padding: "4px 8px",
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 800,
          color: "#e2e8f0",
          background: "rgba(15,23,42,0.72)",
          pointerEvents: "none",
        }}
        aria-live="polite"
      >
        {Math.round(box.w)}px
      </div>
    ) : null;

  if (isAuto) {
    return (
      <div ref={wrapRef} className="jyo-preview-wrapper" style={wrapStyle}>
        {breakpointBadge}
        <div
          className="jyo-preview-viewport"
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            minWidth: 0,
            minHeight: 0,
            borderRadius: t.radiusLg,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {p.children}
        </div>
      </div>
    );
  }

  const lw = logical!.width;
  const lh = logical!.height;
  const s = scale;
  const clipW = lw * s;
  const clipH = lh * s;
  const borderRadius = isMobileFrame ? 28 : t.radiusLg;

  return (
    <div ref={wrapRef} className="jyo-preview-wrapper" style={wrapStyle}>
      <div
        className="jyo-preview-scaler"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
        }}
      >
        <div
          className="jyo-preview-viewport-clip"
          style={{
            width: clipW,
            height: clipH,
            overflow: "hidden",
            borderRadius,
            flexShrink: 0,
            background: "#fff",
            boxShadow: isMobileFrame ? "0 12px 40px rgba(0,0,0,0.28)" : "0 8px 28px rgba(0,0,0,0.18)",
          }}
        >
          <div
            className="jyo-preview-viewport"
            style={{
              width: lw,
              height: lh,
              transform: `scale(${s})`,
              transformOrigin: "top left",
              position: "relative",
            }}
          >
            {p.children}
          </div>
        </div>
      </div>
    </div>
  );
}
