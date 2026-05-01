"use client";

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type PageHeaderProps = Readonly<{
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}> &
  Omit<ComponentPropsWithoutRef<"header">, "title" | "children" | "style" | "className">;

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  children,
  className,
  style,
  ...rest
}: PageHeaderProps) {
  return (
    <header {...rest} className={className} style={{ marginBottom: 8, ...style }}>
      {eyebrow ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: t.textMuted, letterSpacing: "0.04em", marginBottom: 6 }}>
          {eyebrow}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 700, color: t.textPrimary, margin: 0, lineHeight: 1.2 }}>{title}</h1>
        {actions ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>{actions}</div> : null}
      </div>
      {description ? (
        <div style={{ margin: "10px 0 0 0", maxWidth: 720, fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>{description}</div>
      ) : null}
      {children ? <div style={{ marginTop: description || actions ? 12 : 10 }}>{children}</div> : null}
    </header>
  );
}
