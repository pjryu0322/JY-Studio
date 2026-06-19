"use client";

import { useCallback, useEffect, useState } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import {
  defaultPlanningDatabaseSettingsV1,
  type PlanningDatabaseSettingsV1,
} from "@/lib/planning/planningDatabaseSettingsV1";
import {
  isDatabaseUsageEnabledMode,
  resolveDatabaseUsageMode,
} from "@/lib/planning/planningDatabaseUsageMode";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";
import {
  projectDatabaseSaveOutcomeMessage,
  projectDatabaseUserInlineStatusCopy,
  projectDatabaseUserSectionHeadline,
} from "@/lib/planning/projectDatabaseUserDisplay";

type Props = Readonly<{
  readonly projectId: string;
  readonly canEdit: boolean;
  readonly gitRepoName?: string | null;
}>;

export function PlanningDatabaseSettingsSection({ projectId, canEdit, gitRepoName }: Props) {
  const [settings, setSettings] = useState<PlanningDatabaseSettingsV1>(defaultPlanningDatabaseSettingsV1());
  const [busy, setBusy] = useState<"load" | "save" | null>("load");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const repoHint = String(gitRepoName ?? "").trim();
  const usageMode = resolveDatabaseUsageMode(settings);
  const dbUsageEnabled = isDatabaseUsageEnabledMode(usageMode) && settings.enabled;
  const inlineCopy = projectDatabaseUserInlineStatusCopy(settings);

  const load = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    setBusy("load");
    try {
      const res = await credentialsIncludeFetch(`/api/projects/${encodeURIComponent(pid)}/planning/database-settings`);
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
    if (!projectId.trim() || busy === "load") return;
    setSettings((prev) =>
      syncPlanningDatabaseSettingsStoreNames({
        settings: prev,
        gitRepoName: repoHint || null,
        projectId: projectId.trim(),
        preserveManualStoreName: false,
      }),
    );
  }, [repoHint, projectId, busy]);

  const handleToggleDatabaseUsage = (checked: boolean) => {
    if (checked) {
      setSettings((prev) =>
        syncPlanningDatabaseSettingsStoreNames({
          settings: {
            ...prev,
            enabled: true,
            usageMode: "ENABLED_JYPROJECTS_SCHEMA",
            usageSelectionCommitted: true,
            connectionStatus: "NOT_CONFIGURED",
            projectDbStatus: "PLANNED",
          },
          gitRepoName: repoHint || null,
          projectId: projectId.trim(),
          preserveManualStoreName: false,
        }),
      );
      return;
    }
    setSettings((prev) => ({
      ...prev,
      enabled: false,
      usageMode: "DISABLED_JSON_SAMPLE",
      usageSelectionCommitted: true,
      connectionStatus: "NOT_REQUIRED",
      projectDbStatus: "NOT_REQUIRED",
      projectDbFailureReason: null,
    }));
  };

  const persistSettings = async () => {
    setBusy("save");
    setSaveMessage(null);
    try {
      const res = await credentialsIncludeFetch(
        `/api/projects/${encodeURIComponent(projectId.trim())}/planning/database-settings/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings }),
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
      } else {
        setSaveMessage(json.message ?? "설정을 저장하지 못했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="planning-database-settings-section" style={{ maxWidth: 720 }}>
      <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b" }}>
        현재 상태: {projectDatabaseUserSectionHeadline(settings)}
      </p>
      {usageMode === "UNSELECTED" ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
          데이터베이스 사용 여부를 선택해 주세요. 사용하지 않으면 JSON 샘플데이터로 구현단계를 진행합니다. 사용하면
          플랫폼 Runtime Database(`jyprojects`) 안에 프로젝트 schema가 준비됩니다.
        </p>
      ) : null}
      {inlineCopy ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#334155", lineHeight: 1.55 }}>{inlineCopy}</p>
      ) : null}
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={!canEdit || busy !== null}
          onChange={(e) => handleToggleDatabaseUsage(e.target.checked)}
        />
        데이터베이스 사용
      </label>
      {dbUsageEnabled ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
          플랫폼 데이터 저장소를 사용합니다. Quick Design 확정 후 필요한 데이터 구조와 샘플데이터가 자동 생성됩니다.
        </p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          disabled={!canEdit || busy !== null}
          onClick={() => void persistSettings()}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #2563eb",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          {busy === "save" ? "저장 중…" : "저장"}
        </button>
      </div>
      {saveMessage ? (
        <p style={{ marginTop: 10, fontSize: 12, color: "#334155", lineHeight: 1.5 }} role="status">
          {saveMessage}
        </p>
      ) : null}
    </div>
  );
}
