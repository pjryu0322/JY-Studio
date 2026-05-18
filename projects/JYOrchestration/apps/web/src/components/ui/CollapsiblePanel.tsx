"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type CollapsiblePanelProps = Readonly<{
  title: string;
  description?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

export function CollapsiblePanel({
  title,
  description,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  children,
  className,
  style,
}: CollapsiblePanelProps) {
  const controlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlled ? Boolean(openProp) : internalOpen;

  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (!controlled) setInternalOpen(next);
  };

  return (
    <div
      className={className}
      style={{
        borderRadius: t.radiusLg,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
        overflow: "hidden",
        ...style,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          border: "none",
          borderBottom: open ? `1px solid ${t.border}` : "none",
          background: t.bgPage,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.textPrimary }}>{title}</div>
          {description ? <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.45 }}>{description}</div> : null}
        </div>
        <span style={{ fontSize: 12, fontWeight: 900, color: t.textMuted, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div style={{ padding: 14 }}>{children}</div> : null}
    </div>
  );
}
