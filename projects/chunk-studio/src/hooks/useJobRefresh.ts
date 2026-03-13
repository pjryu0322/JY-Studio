"use client";

import { useEffect } from "react";
import { useJobStore } from "@/store/jobStore";

export function useJobRefresh(intervalMs: number): void {
  const refresh = useJobStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, refresh]);
}
