"use client";

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
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
  /** 뷰포트 분기는 마운트 후에만 반영 — SSR·하이드레이션 첫 페인트는 데스크톱 컬럼 규칙과 동일하게 유지 */
  const [layoutCommitted, setLayoutCommitted] = useState(false);
  useEffect(() => {
    setLayoutCommitted(true);
  }, []);
  const useMobileInset = layoutCommitted && isMobile;

  const maxDesktop = wide ? 1440 : narrow ? 960 : 1280;

  return (
    <div
      {...rest}
      className={className}
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: useMobileInset ? "none" : maxDesktop,
        marginLeft: useMobileInset ? 0 : "auto",
        marginRight: useMobileInset ? 0 : "auto",
        paddingLeft: useMobileInset ? 16 : 24,
        paddingRight: useMobileInset ? 16 : 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
