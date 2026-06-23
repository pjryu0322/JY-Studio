"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type ProjectGraphContextMenuItem = Readonly<{
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}>;

export function ProjectGraphContextMenu(p: {
  readonly open: boolean;
  readonly x: number;
  readonly y: number;
  readonly items: readonly ProjectGraphContextMenuItem[];
  readonly ariaLabel: string;
  readonly onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!p.open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) p.onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [p.open, p.onClose]);

  if (!p.open || p.items.length === 0) return null;

  const clampedX = Math.max(8, Math.min(p.x, typeof window !== "undefined" ? window.innerWidth - 220 : p.x));
  const clampedY = Math.max(8, Math.min(p.y, typeof window !== "undefined" ? window.innerHeight - 280 : p.y));

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={p.ariaLabel}
      style={{
        position: "fixed",
        left: clampedX,
        top: clampedY,
        zIndex: 80,
        minWidth: 200,
        padding: 6,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
        boxShadow: "0 12px 40px rgba(15,23,42,0.18)",
      }}
    >
      {p.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onSelect();
            p.onClose();
          }}
          style={menuItemStyle(item.disabled)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function menuItemStyle(disabled?: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    width: "100%",
    minHeight: 44,
    padding: "8px 12px",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    textAlign: "left",
    fontSize: 13,
    fontWeight: 700,
    color: disabled ? t.textMuted : t.textPrimary,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
