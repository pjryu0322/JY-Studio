"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectKnowledgeAgent } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeMemoryPreviewV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService";
import type { UserMemoryControlAction } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlActionService";
import type { UserProjectKnowledgeMemoryUsageApiSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsageTypes";

type ControlResponse = {
  readonly success: boolean;
  readonly control?: UserProjectKnowledgeMemoryControlV1;
  readonly message?: string;
};

import type { UserProjectKnowledgeMemoryStalePreviewV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryStaleTypes";

type PanelResponse = {
  readonly success: boolean;
  readonly control?: UserProjectKnowledgeMemoryControlV1;
  readonly preview?: UserProjectKnowledgeMemoryPreviewV1;
  readonly usageSummary?: UserProjectKnowledgeMemoryUsageApiSummaryV1;
  readonly stalePreview?: UserProjectKnowledgeMemoryStalePreviewV1;
  readonly message?: string;
};

type UsageResponse = {
  readonly success: boolean;
  readonly summary?: UserProjectKnowledgeMemoryUsageApiSummaryV1;
  readonly message?: string;
};

export function useUserProjectKnowledgeMemoryControl(projectId: string) {
  const pid = projectId.trim();
  const [control, setControl] = useState<UserProjectKnowledgeMemoryControlV1 | null>(null);
  const [preview, setPreview] = useState<UserProjectKnowledgeMemoryPreviewV1 | null>(null);
  const [usageSummary, setUsageSummary] = useState<UserProjectKnowledgeMemoryUsageApiSummaryV1 | null>(null);
  const [stalePreview, setStalePreview] = useState<UserProjectKnowledgeMemoryStalePreviewV1 | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadUsage = useCallback(async () => {
    if (!pid) {
      setUsageSummary(null);
      return;
    }
    setUsageError(null);
    try {
      const q = encodeURIComponent(pid);
      const res = await fetch(`/api/project-knowledge/user-memory-usage?projectId=${q}`, {
        credentials: "include",
      });
      const json = (await res.json()) as UsageResponse;
      if (!res.ok || !json.success || !json.summary) {
        throw new Error(json.message ?? "사용 이력을 불러오지 못했습니다.");
      }
      setUsageSummary(json.summary);
    } catch (e) {
      setUsageSummary(null);
      setUsageError(e instanceof Error ? e.message : "사용 이력 조회 실패");
    }
  }, [pid]);

  const reloadStalePreview = useCallback(async () => {
    if (!pid) {
      setStalePreview(null);
      return;
    }
    try {
      const q = encodeURIComponent(pid);
      const res = await fetch(`/api/project-knowledge/user-memory-stale-preview?projectId=${q}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { success: boolean; preview?: UserProjectKnowledgeMemoryStalePreviewV1 };
      if (!res.ok || !json.success || !json.preview) {
        throw new Error("정리 후보를 불러오지 못했습니다.");
      }
      setStalePreview(json.preview);
    } catch {
      setStalePreview(null);
    }
  }, [pid]);

  const reload = useCallback(async () => {
    if (!pid) {
      setControl(null);
      setPreview(null);
      setUsageSummary(null);
      setStalePreview(null);
      return;
    }
    setLoading(true);
    setError(null);
    setUsageError(null);
    try {
      const q = encodeURIComponent(pid);
      const res = await fetch(`/api/project-knowledge/user-memory-panel?projectId=${q}`, {
        credentials: "include",
      });
      const json = (await res.json()) as PanelResponse;
      if (!res.ok || !json.success || !json.control || !json.preview || !json.usageSummary || !json.stalePreview) {
        throw new Error(json.message ?? "불러오기에 실패했습니다.");
      }
      setControl(json.control);
      setPreview(json.preview);
      setUsageSummary(json.usageSummary);
      setStalePreview(json.stalePreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
      setUsageSummary(null);
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sendAction = useCallback(
    async (action: UserMemoryControlAction) => {
      if (!pid) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/project-knowledge/user-memory-control", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: pid, action }),
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
      await sendAction({ type: "SET_ENABLED", enabled });
    },
    [sendAction],
  );

  const setAgentEnabled = useCallback(
    async (agent: ProjectKnowledgeAgent, enabled: boolean) => {
      await sendAction({ type: "SET_AGENT_ENABLED", agent, enabled });
    },
    [sendAction],
  );

  const togglePin = useCallback(
    async (actionId: string, pinned: boolean) => {
      const id = actionId.trim();
      if (!id) return;
      await sendAction({
        type: pinned ? "PIN_MEMORY_ITEM" : "UNPIN_MEMORY_ITEM",
        actionId: id,
      });
    },
    [sendAction],
  );

  const toggleIgnore = useCallback(
    async (actionId: string, ignored: boolean) => {
      const id = actionId.trim();
      if (!id) return;
      await sendAction({
        type: ignored ? "IGNORE_MEMORY_ITEM" : "UNIGNORE_MEMORY_ITEM",
        actionId: id,
      });
    },
    [sendAction],
  );

  const excludeSourceProject = useCallback(
    async (sourceProjectActionId: string) => {
      const id = sourceProjectActionId.trim();
      if (!id) return;
      await sendAction({ type: "EXCLUDE_SOURCE_PROJECT", actionId: id });
    },
    [sendAction],
  );

  return {
    control,
    preview,
    usageSummary,
    stalePreview,
    usageError,
    loading,
    saving,
    error,
    reload,
    reloadUsage,
    reloadStalePreview,
    setEnabled,
    setAgentEnabled,
    togglePin,
    toggleIgnore,
    excludeSourceProject,
  };
}
