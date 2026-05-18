"use client";

import { useCallback } from "react";
import { fetchSpecWorkspace, type SpecWorkspaceSnapshot } from "@/components/project-spec/api";
import { useProjectResourceLoad } from "@/lib/workspace/useProjectResourceLoad";

export function useProjectSpecWorkspaceData(
  projectId: string,
  hydrateFromSnapshot: (snapshot: SpecWorkspaceSnapshot) => void
) {
  const load = useCallback(
    async (id: string) => {
      try {
        const { res, json } = await fetchSpecWorkspace(id);
        if (!res.ok || !json.success || !json.data) {
          return {
            data: null as SpecWorkspaceSnapshot | null,
            errorMessage: json.message || "워크스페이스를 불러오지 못했습니다.",
          };
        }
        const normalized: SpecWorkspaceSnapshot = {
          ...json.data,
          specVersions: json.data.specVersions ?? [],
          responses: json.data.responses ?? [],
          specPromptConfig: json.data.specPromptConfig ?? null,
        };
        return { data: normalized, errorMessage: null as string | null };
      } catch (e) {
        console.error(e);
        return { data: null, errorMessage: "워크스페이스 조회 중 오류가 발생했습니다." };
      }
    },
    []
  );

  const { data: workspace, setData: setWorkspace, loadError, loading: loadingWs, reload: loadWorkspace } =
    useProjectResourceLoad<SpecWorkspaceSnapshot>({
      projectId,
      enabled: Boolean(projectId.trim()),
      load,
      onLoaded: hydrateFromSnapshot,
    });

  return { workspace, setWorkspace, loadError, loadingWs, loadWorkspace };
}
