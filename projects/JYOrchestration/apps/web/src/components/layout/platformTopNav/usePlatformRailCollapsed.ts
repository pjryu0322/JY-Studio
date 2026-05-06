"use client";

import { useCallback, useEffect, useState } from "react";
import { PLATFORM_RAIL_COLLAPSED_KEY } from "@/lib/layout/platformTopNavConstants";

export function usePlatformRailCollapsed(): readonly [boolean, (next: boolean) => void] {
  const [railCollapsed, setRailCollapsed] = useState(false);

  /* 클라이언트 마운트 후 localStorage와 동기화 — SSR과 초기 HTML 일치를 위해 초기값은 펼침(false). */
  useEffect(() => {
    try {
      if (localStorage.getItem(PLATFORM_RAIL_COLLAPSED_KEY) === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 저장된 접힘 상태만 복원
        setRailCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistRailCollapsed = useCallback((next: boolean) => {
    setRailCollapsed(next);
    try {
      localStorage.setItem(PLATFORM_RAIL_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return [railCollapsed, persistRailCollapsed] as const;
}
