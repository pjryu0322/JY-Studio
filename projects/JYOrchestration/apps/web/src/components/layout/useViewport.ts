"use client";

import { useEffect, useState } from "react";

/** Viewport width below this is treated as mobile layout. */
export const LAYOUT_MOBILE_BREAKPOINT = 1024;

/**
 * Responsive layout breakpoint hook. SSR-safe: no `window` during render.
 * Until the client measures, defaults to desktop (`width` = breakpoint) to match desktop-first shell.
 */
export function useViewport(): {
  width: number;
  isMobile: boolean;
  isDesktop: boolean;
} {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const read = () => setWidth(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  const w = width ?? LAYOUT_MOBILE_BREAKPOINT;
  const isMobile = w < LAYOUT_MOBILE_BREAKPOINT;
  const isDesktop = !isMobile;

  return { width: w, isMobile, isDesktop };
}
