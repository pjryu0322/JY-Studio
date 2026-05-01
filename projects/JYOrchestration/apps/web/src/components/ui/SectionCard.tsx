"use client";

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type SectionCardProps = Readonly<
  {
    title: string;
    description?: string;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
  } & Omit<ComponentPropsWithoutRef<"section">, "title" | "children" | "style" | "className">
>;

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  style,
  ...rest
}: SectionCardProps) {
  return (
    <section
      {...rest}
      className={className}
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: "100%",
        maxWidth: "none",
        marginBottom: 20,
        borderRadius: t.radiusLg,
        border: `1px solid ${t.border}`,
        background: t.bgCard,
        padding: 20,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: description || actions ? 12 : 16,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600, color: t.textPrimary, margin: 0, lineHeight: 1.25 }}>{title}</h2>
        {actions ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{actions}</div> : null}
      </div>
      {description ? (
        <p style={{ margin: "0 0 16px 0", fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{description}</p>
      ) : null}
      <div>{children}</div>
    </section>
  );
}
