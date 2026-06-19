"use client";

import { useCallback, useEffect, useState } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import {
  defaultPlanningDatabaseSettingsV1,
  type PlanningDatabaseSettingsV1,
} from "@/lib/planning/planningDatabaseSettingsV1";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";
import { projectDatabaseSaveOutcomeMessage } from "@/lib/planning/projectDatabaseUserDisplay";

export function applyPlanningDatabaseUsageToggle(input: Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly enabled: boolean;
  readonly gitRepoName?: string | null;
  readonly projectId: string;
}>): PlanningDatabaseSettingsV1 {
  if (input.enabled) {
    return syncPlanningDatabaseSettingsStoreNames({
      settings: {
        ...input.settings,
        enabled: true,
        usageMode: "ENABLED_JYPROJECTS_SCHEMA",
        usageSelectionCommitted: true,
        connectionStatus: "NOT_CONFIGURED",
        dataStoreStatus: "PLANNED",
      },
      gitRepoName: input.gitRepoName ?? null,
      projectId: input.projectId.trim(),
      preserveManualStoreName: false,
    });
  }
  return {
    ...input.settings,
    enabled: false,
    usageMode: "DISABLED_JSON_SAMPLE",
    usageSelectionCommitted: true,
    connectionStatus: "NOT_REQUIRED",
    dataStoreStatus: "NOT_REQUIRED",
    dataStoreFailureReason: null,
  };
}

export function usePlanningDatabaseSettings(input: Readonly<{
  readonly projectId: string;
  readonly gitRepoName?: string | null;
  readonly onSettingsSaved?: () => void;
}>) {
  const [settings, setSettings] = useState<PlanningDatabaseSettingsV1>(defaultPlanningDatabaseSettingsV1());
  const [busy, setBusy] = useState<"load" | "save" | null>("load");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const repoHint = String(input.gitRepoName ?? "").trim();
  const projectId = input.projectId.trim();

  const load = useCallback(async () => {
    if (!projectId) return;
    setBusy("load");
    try {
      const res = await credentialsIncludeFetch(
        `/api/projects/${encodeURIComponent(projectId)}/planning/database-settings`,
      );
      const json = (await res.json()) as { success?: boolean; data?: { settings?: PlanningDatabaseSettingsV1 } };
      if (json.success && json.data?.settings) {
        setSettings(json.data.settings);
      }
    } finally {
      setBusy(null);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!projectId || busy === "load") return;
    setSettings((prev) =>
      syncPlanningDatabaseSettingsStoreNames({
        settings: prev,
        gitRepoName: repoHint || null,
        projectId,
        preserveManualStoreName: false,
      }),
    );
  }, [repoHint, projectId, busy]);

  const persistSettings = useCallback(
    async (next: PlanningDatabaseSettingsV1): Promise<PlanningDatabaseSettingsV1 | null> => {
      if (!projectId) return null;
      setBusy("save");
      setSaveMessage(null);
      try {
        const res = await credentialsIncludeFetch(
          `/api/projects/${encodeURIComponent(projectId)}/planning/database-settings/save`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings: next }),
          },
        );
        const json = (await res.json()) as {
          success?: boolean;
          message?: string;
          data?: { settings?: PlanningDatabaseSettingsV1; message?: string };
        };
        if (json.success && json.data?.settings) {
          setSettings(json.data.settings);
          setSaveMessage(json.data.message ?? projectDatabaseSaveOutcomeMessage(json.data.settings));
          input.onSettingsSaved?.();
          return json.data.settings;
        }
        setSaveMessage(json.message ?? "설정을 저장하지 못했습니다. 다시 시도해 주세요.");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [projectId, input.onSettingsSaved],
  );

  const setDatabaseUsageEnabled = useCallback(
    (enabled: boolean) => {
      setSettings((prev) =>
        applyPlanningDatabaseUsageToggle({
          settings: prev,
          enabled,
          gitRepoName: repoHint || null,
          projectId,
        }),
      );
    },
    [projectId, repoHint],
  );

  return {
    settings,
    setSettings,
    busy,
    saveMessage,
    setSaveMessage,
    load,
    persistSettings,
    setDatabaseUsageEnabled,
  };
}
