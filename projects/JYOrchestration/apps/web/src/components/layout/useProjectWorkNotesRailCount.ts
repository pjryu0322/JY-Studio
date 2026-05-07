"use client";

import { useCallback, useEffect, useState } from "react";
import { PROJECT_WORK_NOTES_RAIL_REFRESH_EVENT } from "@/lib/worknote/projectWorkNotesRailEvents";

/**
 * 프로젝트 레일 배지용 — GET /api/work-notes?projectId=… 의 현재 사용자 메모 개수.
 */
export function useProjectWorkNotesRailCount(projectId: string | null): number {
  const pid = projectId?.trim() ?? "";
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!pid) {
      setCount(0);
      return;
    }
    try {
      const res = await fetch(`/api/work-notes?projectId=${encodeURIComponent(pid)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as { success?: boolean; data?: { notes?: unknown[] } };
      if (!res.ok || !json.success || !Array.isArray(json.data?.notes)) {
        setCount(0);
        return;
      }
      setCount(json.data.notes.length);
    } catch {
      setCount(0);
    }
  }, [pid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pid || typeof window === "undefined") return;
    const onRefresh = (ev: Event) => {
      const ce = ev as CustomEvent<{ projectId?: string }>;
      if (ce.detail?.projectId === pid) void load();
    };
    window.addEventListener(PROJECT_WORK_NOTES_RAIL_REFRESH_EVENT, onRefresh);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(PROJECT_WORK_NOTES_RAIL_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pid, load]);

  return pid ? count : 0;
}
