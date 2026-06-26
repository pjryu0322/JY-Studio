"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeMemoryPreviewV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService";

type ControlResponse = {
  readonly success: boolean;
  readonly control?: UserProjectKnowledgeMemoryControlV1;
  readonly message?: string;
};

type PreviewResponse = UserProjectKnowledgeMemoryPreviewV1 & {
  readonly success: boolean;
  readonly message?: string;
};

export function useUserProjectKnowledgeMemoryControl(projectId: string) {
  const pid = projectId.trim();
  const [control, setControl] = useState<UserProjectKnowledgeMemoryControlV1 | null>(null);
  const [preview, setPreview] = useState<UserProjectKnowledgeMemoryPreviewV1 | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!pid) {
      setControl(null);
      setPreview(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = encodeURIComponent(pid);
      const [controlRes, previewRes] = await Promise.all([
        fetch(`/api/project-knowledge/user-memory-control?projectId=${q}`, { credentials: "include" }),
        fetch(`/api/project-knowledge/user-memory-preview?projectId=${q}`, { credentials: "include" }),
      ]);
      const controlJson = (await controlRes.json()) as ControlResponse;
      const previewJson = (await previewRes.json()) as PreviewResponse;
      if (!controlRes.ok || !controlJson.success || !controlJson.control) {
        throw new Error(controlJson.message ?? "설정을 불러오지 못했습니다.");
      }
      if (!previewRes.ok || !previewJson.success) {
        throw new Error(previewJson.message ?? "미리보기를 불러오지 못했습니다.");
      }
      setControl(controlJson.control);
      const { success: _s, message: _m, ...previewBody } = previewJson;
      setPreview(previewBody);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patchControl = useCallback(
    async (patch: Partial<UserProjectKnowledgeMemoryControlV1>) => {
      if (!pid) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/project-knowledge/user-memory-control", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: pid, patch }),
        });
        const json = (await res.json()) as ControlResponse;
        if (!res.ok || !json.success || !json.control) {
          throw new Error(json.message ?? "저장하지 못했습니다.");
        }
        setControl(json.control);
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장 실패");
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [pid, reload],
  );

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      await patchControl({ enabled });
    },
    [patchControl],
  );

  const togglePin = useCallback(
    async (displayId: string, pinned: boolean) => {
      if (!control) return;
      const id = displayId.trim();
      if (!id) return;
      const pinnedSet = new Set(control.pinnedMemoryItemIds);
      const ignoredSet = new Set(control.ignoredMemoryItemIds);
      if (pinned) {
        pinnedSet.add(id);
        ignoredSet.delete(id);
      } else {
        pinnedSet.delete(id);
      }
      await patchControl({
        pinnedMemoryItemIds: [...pinnedSet],
        ignoredMemoryItemIds: [...ignoredSet],
      });
    },
    [control, patchControl],
  );

  const toggleIgnore = useCallback(
    async (displayId: string, ignored: boolean) => {
      if (!control) return;
      const id = displayId.trim();
      if (!id) return;
      const pinnedSet = new Set(control.pinnedMemoryItemIds);
      const ignoredSet = new Set(control.ignoredMemoryItemIds);
      if (ignored) {
        ignoredSet.add(id);
        pinnedSet.delete(id);
      } else {
        ignoredSet.delete(id);
      }
      await patchControl({
        pinnedMemoryItemIds: [...pinnedSet],
        ignoredMemoryItemIds: [...ignoredSet],
      });
    },
    [control, patchControl],
  );

  const excludeSourceProject = useCallback(
    async (sourceProjectActionId: string) => {
      if (!control) return;
      const id = sourceProjectActionId.trim();
      if (!id) return;
      const set = new Set(control.excludedSourceProjectIds);
      set.add(id);
      await patchControl({ excludedSourceProjectIds: [...set] });
    },
    [control, patchControl],
  );

  return {
    control,
    preview,
    loading,
    saving,
    error,
    reload,
    setEnabled,
    togglePin,
    toggleIgnore,
    excludeSourceProject,
  };
}
