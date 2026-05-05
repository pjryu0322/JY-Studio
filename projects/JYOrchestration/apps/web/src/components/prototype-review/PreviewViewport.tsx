"use client";

import type { CSSProperties } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { LoadingState } from "@/components/ui/LoadingState";
import { uiTokens as t } from "@/components/ui/tokens";
import { useProjectPrototypePreview } from "@/lib/project/useProjectPrototypePreview";
import type {
  PrototypePreviewMobileDevice,
  PrototypePreviewWorkMode,
} from "@/lib/preferences/prototypePreviewViewport";
import { PROTOTYPE_PREVIEW_PRESETS } from "@/lib/preferences/prototypePreviewViewport";

const wrapBand: CSSProperties = {
  position: "relative",
  flex: "3 1 0",
  minHeight: "min(62vh, 640px)",
  maxHeight: "72vh",
  borderRadius: t.radiusLg,
  border: `1px solid ${t.border}`,
  background: "#0f172a",
  overflow: "hidden",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
};

const wrapFill: CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  width: "100%",
  height: "100%",
  borderRadius: t.radiusLg,
  border: `1px solid ${t.border}`,
  background: "#0f172a",
  overflow: "hidden",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
};

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

export function PreviewViewport(p: {
  /** 프로토타입 Preview 뷰포트 설정(프로젝트별 localStorage) */
  readonly projectId: string;
  readonly run: PrototypeRun | null;
  readonly frameLoading: boolean;
  readonly onFrameLoad: () => void;
  /** 상위 flex 영역을 채우고(오버레이 대화 등), 높이 상한을 두지 않음 */
  readonly fillContainer?: boolean;
  /** Desktop·Mobile 고정 뷰포트에서 가로·세로 전환 */
  readonly rotationLandscape?: boolean;
}) {
  const { prototypePreviewWorkMode, prototypePreviewMobileDevice } = useProjectPrototypePreview(p.projectId);
  const rotation = Boolean(p.rotationLandscape);

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
  }, [measure, prototypePreviewWorkMode, prototypePreviewMobileDevice, rotation]);

  const logical = useMemo(
    () => logicalViewportPx(prototypePreviewWorkMode, prototypePreviewMobileDevice, rotation),
    [prototypePreviewWorkMode, prototypePreviewMobileDevice, rotation],
  );

  const scale = useMemo(() => {
    if (!logical || box.w <= 0 || box.h <= 0) return 1;
    return Math.min(1, box.w / logical.width, box.h / logical.height);
  }, [logical, box.w, box.h]);

  const isAuto = prototypePreviewWorkMode === "auto";
  const isMobileFrame = prototypePreviewWorkMode === "mobile";

  const previewWrapperStyle: CSSProperties = {
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

  const publicU = String(p.run?.publicUrl ?? "").trim();
  const deployed = p.run?.deploymentStatus === "DONE" && publicU;
  const draft = String(p.run?.previewUrl ?? p.run?.suggestedPreviewUrl ?? "").trim();
  const url = deployed ? publicU : draft;
  const safe = url.startsWith("http://") || url.startsWith("https://");
  const wrap = p.fillContainer ? wrapFill : wrapBand;

  const iframeEl = (
    <iframe
      key={url}
      title="프로토타입 프리뷰"
      src={url}
      onLoad={p.onFrameLoad}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        border: "none",
        display: "block",
        background: "#fff",
      }}
    />
  );

  const lw = logical?.width ?? 0;
  const lh = logical?.height ?? 0;
  const s = scale;
  const clipW = lw * s;
  const clipH = lh * s;
  const mobileFrameRadius = 28;

  const previewInner = isAuto ? (
    <div ref={wrapRef} className="jyo-preview-wrapper" style={previewWrapperStyle}>
      {box.w > 0 ? (
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
      ) : null}
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
        {iframeEl}
      </div>
    </div>
  ) : (
    <div ref={wrapRef} className="jyo-preview-wrapper" style={previewWrapperStyle}>
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
            borderRadius: isMobileFrame ? mobileFrameRadius : t.radiusLg,
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
            {iframeEl}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div id="jyo-prototype-review-preview" style={wrap} aria-label="프로토타입 미리보기 영역">
      {!p.run ? (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <p style={{ margin: 0, textAlign: "center", fontSize: 15, color: "#e2e8f0", lineHeight: 1.65 }}>
            실행 정보가 없습니다.
            <br />
            <span style={{ fontSize: 13, color: "#94a3b8" }}>프로토타입 생성 단계에서 실행을 시작해 주세요.</span>
          </p>
        </div>
      ) : !safe ? (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: t.bgPage }}>
          <p style={{ margin: 0, textAlign: "center", fontSize: 15, color: t.textSecondary, lineHeight: 1.65 }}>
            {draft
              ? "Preview URL 형식이 올바르지 않습니다."
              : "Preview 준비 필요 — 검토용 URL이 아직 없습니다. GitHub Pages 설정·브랜치를 확인하거나 생성 단계를 마쳐 주세요."}
          </p>
        </div>
      ) : (
        <>
          {p.frameLoading ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(15, 23, 42, 0.55)",
              }}
            >
              <div style={{ padding: "12px 16px", borderRadius: 10, background: t.bgCard, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                <LoadingState label="프리뷰 불러오는 중…" />
              </div>
            </div>
          ) : null}
          {previewInner}
        </>
      )}
    </div>
  );
}
