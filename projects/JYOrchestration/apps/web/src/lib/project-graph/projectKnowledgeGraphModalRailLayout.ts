import type { CSSProperties } from "react";
import { platformRailOverlayLeftInsetPx } from "@/lib/layout/platformTopNavConstants";

const DESKTOP_DIALOG_MARGIN_PX = 16;
const DESKTOP_DIALOG_TOP = "5vh";
const DESKTOP_DIALOG_HEIGHT = "90vh";

export function computeKnowledgeGraphModalRailInset(input: Readonly<{
  readonly preservePlatformRail?: boolean;
  readonly fullscreen: boolean;
  readonly railCollapsed: boolean;
}>): number {
  if (!input.preservePlatformRail || input.fullscreen) return 0;
  return platformRailOverlayLeftInsetPx(input.railCollapsed);
}

/** Desktop modal shell styles when rail must stay visible. */
export function knowledgeGraphModalShellDesktopStyles(railInset: number): Readonly<{
  backdrop: CSSProperties;
  dialog: CSSProperties;
}> {
  if (railInset <= 0) {
    return {
      backdrop: { position: "fixed", inset: 0, zIndex: 48 },
      dialog: {
        position: "fixed",
        left: "5vw",
        top: DESKTOP_DIALOG_TOP,
        width: "90vw",
        height: DESKTOP_DIALOG_HEIGHT,
        borderRadius: 16,
      },
    };
  }

  const margin = DESKTOP_DIALOG_MARGIN_PX;
  return {
    backdrop: {
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      left: railInset,
      zIndex: 48,
    },
    dialog: {
      position: "fixed",
      left: `calc(${railInset}px + ${margin}px)`,
      top: DESKTOP_DIALOG_TOP,
      width: `calc(100vw - ${railInset}px - ${margin * 2}px)`,
      height: DESKTOP_DIALOG_HEIGHT,
      borderRadius: 16,
    },
  };
}
