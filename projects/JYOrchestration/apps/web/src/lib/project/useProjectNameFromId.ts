"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchProjectById } from "@/components/project-spec/api";

/**
 * projectId로 프로젝트 이름을 조회합니다. id가 비어 있으면 null을 반환합니다.
 * (TopNav, 툴바 등에서 공통 사용)
 */
export function useProjectNameFromId(projectId: string | null | undefined): string | null {
  const pid = String(projectId ?? "").trim();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!pid) return;
    let cancelled = false;
    void (async () => {
      try {
        const { project } = await fetchProjectById(pid);
        if (cancelled) return;
        const n = String(project?.name ?? "").trim();
        setName(n || null);
      } catch {
        if (!cancelled) setName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pid]);

  return useMemo(() => (pid ? name : null), [pid, name]);
}
