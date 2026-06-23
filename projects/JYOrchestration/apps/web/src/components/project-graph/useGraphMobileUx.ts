"use client";

import { useMediaQuery } from "@/components/ui/useMediaQuery";

/** Knowledge Graph 모바일 UX (Bottom Sheet, FAB) — 768px 미만 */
export function useGraphMobileUx(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
