"use client";

import type { CSSProperties } from "react";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { LoadingState } from "@/components/ui/LoadingState";
import { uiTokens as t } from "@/components/ui/tokens";

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
};

export function PreviewViewport(p: {
  readonly run: PrototypeRun | null;
  readonly frameLoading: boolean;
  readonly onFrameLoad: () => void;
  /** 상위 flex 영역을 채우고(오버레이 대화 등), 높이 상한을 두지 않음 */
  readonly fillContainer?: boolean;
}) {
  const url = p.run?.previewUrl || p.run?.suggestedPreviewUrl || p.run?.resultUrl || "";
  const safe = url.startsWith("http://") || url.startsWith("https://");
  const wrap = p.fillContainer ? wrapFill : wrapBand;
  const iframeMinH = p.fillContainer ? 0 : "min(62vh, 640px)";

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
            등록된 Preview 화면이 없습니다.
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
          <iframe
            key={url}
            title="프로토타입 프리뷰"
            src={url}
            onLoad={p.onFrameLoad}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={{
              width: "100%",
              height: "100%",
              minHeight: iframeMinH,
              border: "none",
              display: "block",
              background: "#fff",
            }}
          />
        </>
      )}
    </div>
  );
}
