"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type TabItem = Readonly<{ id: string; label: string; disabled?: boolean }>;

export type TabsProps = Readonly<{
  tabs: readonly TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  style?: CSSProperties;
}>;

export function Tabs({ tabs, value, onChange, className, style }: TabsProps) {
  return (
    <div
      className={className}
      role="tablist"
      style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", ...style }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        const disabled = Boolean(tab.disabled);
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange(tab.id);
            }}
            style={{
              padding: "6px 12px",
              borderRadius: t.radiusMd,
              border: `1px solid ${selected ? t.primary : t.border}`,
              background: selected ? `${t.primary}14` : t.bgCard,
              color: selected ? t.primary : t.textSecondary,
              fontSize: 12,
              fontWeight: 800,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
