"use client";

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type CardProps = Readonly<
  {
    children?: ReactNode;
    title?: string;
    description?: string;
    footer?: ReactNode;
    compact?: boolean;
    className?: string;
    style?: CSSProperties;
  } & Omit<ComponentPropsWithoutRef<"div">, "title" | "children" | "style" | "className">
>;

export function Card({ children, title, description, footer, compact, className, style, ...rest }: CardProps) {
  const pad = compact ? 12 : 16;
  const root: CSSProperties = {
    boxSizing: "border-box",
    width: "100%",
    borderRadius: t.radiusLg,
    border: `1px solid ${t.border}`,
    background: t.bgCard,
    ...style,
  };

  return (
    <div {...rest} className={className} style={root}>
      {title || description ? (
        <div style={{ padding: `${pad}px ${pad}px 0` }}>
          {title ? (
            <div style={{ fontSize: compact ? 15 : 16, fontWeight: 700, color: t.textPrimary, marginBottom: description ? 6 : 0 }}>
              {title}
            </div>
          ) : null}
          {description ? (
            <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5, marginBottom: 4 }}>{description}</div>
          ) : null}
        </div>
      ) : null}
      <div style={{ padding: title || description ? `${compact ? 8 : 12}px ${pad}px ${pad}px` : pad }}>{children}</div>
      {footer ? (
        <div
          style={{
            padding: `${compact ? 8 : 12}px ${pad}px ${pad}px`,
            borderTop: `1px solid ${t.border}`,
            background: t.bgPage,
            borderRadius: `0 0 ${t.radiusLg}px ${t.radiusLg}px`,
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}
