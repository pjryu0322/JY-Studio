import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

/**
 * 채팅 입력 등 앵커 바로 위에 붙는 팝오버 컨테이너
 * (`+` 도구 메뉴, `@@` 멘션 피커 등 공통).
 */
export function composerPopoverAboveAnchorStyle(zIndex: number): CSSProperties {
  return {
    position: "absolute",
    bottom: "calc(100% + 8px)",
    left: 0,
    minWidth: 216,
    padding: 6,
    borderRadius: t.radiusLg,
    border: `1px solid ${t.border}`,
    background: t.bgCard,
    boxShadow: "0 12px 40px -12px rgba(15, 23, 42, 0.2)",
    zIndex,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };
}
