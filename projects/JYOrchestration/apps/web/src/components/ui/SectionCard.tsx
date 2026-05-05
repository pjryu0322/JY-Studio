"use client";

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type SectionCardProps = Readonly<
  {
    /** 생략 시 제목 행을 렌더하지 않습니다. */
    title?: string;
    description?: string;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
    style?: CSSProperties;
    /** 본문 래퍼(`children`을 감싸는 div)에만 적용 — 스크롤 영역·플렉스 채움 등 */
    contentStyle?: CSSProperties;
  } & Omit<ComponentPropsWithoutRef<"section">, "title" | "children" | "style" | "className">
>;

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  style,
  contentStyle,
  ...rest
}: SectionCardProps) {
  const showTitleRow = Boolean(title?.trim()) || Boolean(actions);
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
      {showTitleRow ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: description ? 12 : 16,
          }}
        >
          {title?.trim() ? (
            <h2 style={{ fontSize: 22, fontWeight: 600, color: t.textPrimary, margin: 0, lineHeight: 1.25 }}>{title}</h2>
          ) : (
            <span style={{ flex: "1 1 auto", minWidth: 0 }} aria-hidden />
          )}
          {actions ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{actions}</div> : null}
        </div>
      ) : null}
      {description ? (
        <p style={{ margin: "0 0 16px 0", fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{description}</p>
      ) : null}
      <div style={contentStyle}>{children}</div>
    </section>
  );
}
