"use client";

import { useCallback, useEffect, useState } from "react";

export type ProjectResourceLoadResult<T> = {
  data: T | null;
  errorMessage: string | null;
};

/**
 * `projectId` 기준 단일 리소스 로드(로딩·에러·수동 재시도) 패턴을 공통화합니다.
 */
export function useProjectResourceLoad<T>(options: {
  projectId: string;
  enabled?: boolean;
  load: (projectId: string) => Promise<ProjectResourceLoadResult<T>>;
  onLoaded?: (data: T) => void;
}) {
  const { projectId, enabled = true, load, onLoaded } = options;
  const [data, setData] = useState<T | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!enabled || !projectId.trim()) {
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const r = await load(projectId);
      if (r.errorMessage) {
        setLoadError(r.errorMessage);
        setData(null);
        return;
      }
      const next = r.data ?? null;
      setData(next);
      if (next != null && onLoaded) {
        onLoaded(next);
      }
    } catch (e) {
      console.error(e);
      setLoadError("요청 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId, enabled, load, onLoaded]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, loadError, loading, reload };
}
