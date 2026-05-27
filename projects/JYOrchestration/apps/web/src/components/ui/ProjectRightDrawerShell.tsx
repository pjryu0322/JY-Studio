"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

const DEFAULT_BACKDROP_Z_INDEX = 1150;
const DEFAULT_PANEL_Z_INDEX = 1160;
const DEFAULT_PANEL_WIDTH = "min(520px, 100vw)";

export type ProjectRightDrawerShellProps = Readonly<{
  readonly open: boolean;
  readonly onClose: () => void;
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly closeOnEscape?: boolean;
  readonly width?: string;
  readonly backdropZIndex?: number;
  readonly panelZIndex?: number;
}>;

export function ProjectRightDrawerShell({
  open,
  onClose,
  ariaLabel,
  children,
  closeOnEscape = true,
  width = DEFAULT_PANEL_WIDTH,
  backdropZIndex = DEFAULT_BACKDROP_Z_INDEX,
  panelZIndex = DEFAULT_PANEL_Z_INDEX,
}: ProjectRightDrawerShellProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const backdropStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: backdropZIndex,
    background: "rgba(15, 23, 42, 0.4)",
  };

  const panelStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    right: 0,
    zIndex: panelZIndex,
    width,
    height: "100%",
    background: "#fff",
    borderLeft: "1px solid #e2e8f0",
    boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.12)",
    display: "flex",
    flexDirection: "column",
  };

  return (
    <>
      <div style={backdropStyle} role="presentation" onClick={onClose} />
      <aside style={panelStyle} aria-label={ariaLabel}>
        {children}
      </aside>
    </>
  );
}
