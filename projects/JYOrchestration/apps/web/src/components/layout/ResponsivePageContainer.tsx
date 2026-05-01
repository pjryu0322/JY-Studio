"use client";

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { useViewport } from "@/components/layout/useViewport";

export type ResponsivePageContainerProps = Readonly<
  {
    children: ReactNode;
    /** Desktop max-width ~960px */
    narrow?: boolean;
    /** Desktop max-width ~1440px */
    wide?: boolean;
    style?: CSSProperties;
  } & Omit<ComponentPropsWithoutRef<"div">, "children" | "style">
>;

/**
 * Horizontal padding and max-width: desktop uses centered column; mobile full-bleed with 16px inset.
 */
export function ResponsivePageContainer(p: ResponsivePageContainerProps) {
  const { narrow, wide, children, style, className, ...rest } = p;
  const { isMobile } = useViewport();

  const maxDesktop = wide ? 1440 : narrow ? 960 : 1280;

  return (
    <div
      {...rest}
      className={className}
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: isMobile ? "none" : maxDesktop,
        marginLeft: isMobile ? 0 : "auto",
        marginRight: isMobile ? 0 : "auto",
        paddingLeft: isMobile ? 16 : 24,
        paddingRight: isMobile ? 16 : 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
