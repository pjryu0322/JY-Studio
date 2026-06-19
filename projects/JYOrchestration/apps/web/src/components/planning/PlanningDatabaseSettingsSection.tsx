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
  projectDatabaseUserInlineStatusCopy,
  projectDatabaseUserSectionHeadline,
} from "@/lib/planning/projectDatabaseUserDisplay";
import { readProjectDatabaseLifecycleStatus } from "@/lib/planning/projectDatabaseLifecycle";

type Props = Readonly<{
  readonly projectId: string;
  readonly canEdit: boolean;
  readonly gitRepoName?: string | null;
}>;

export function PlanningDatabaseSettingsSection({ projectId, canEdit, gitRepoName }: Props) {
  const [settings, setSettings] = useState<PlanningDatabaseSettingsV1>(defaultPlanningDatabaseSettingsV1());
  const [busy, setBusy] = useState<"load" | "save" | null>("load");
  const [message, setMessage] = useState<string | null>(null);
  const repoHint = String(gitRepoName ?? "").trim();
  const usageMode = resolveDatabaseUsageMode(settings);
  const dbUsageEnabled = isDatabaseUsageEnabledMode(usageMode) && settings.enabled;
  const projectDbStatus = readProjectDatabaseLifecycleStatus(settings.projectDbStatus);
  const showRetry = dbUsageEnabled && projectDbStatus === "FAILED";
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
        preserveManualStoreName: true,
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
            usageMode: "ENABLED_PROJECT_DATABASE",
            usageSelectionCommitted: true,
            connectionStatus: "NOT_CONFIGURED",
          },
          gitRepoName: repoHint || null,
          projectId: projectId.trim(),
          preserveManualStoreName: true,
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
    }));
  };

  const persistSettings = async () => {
    setBusy("save");
    setMessage(null);
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
        data?: {
          settings?: PlanningDatabaseSettingsV1;
          message?: string;
          saved?: boolean;
          projectDbStatus?: string;
        };
      };
      if (json.success && json.data?.settings) {
        setSettings(json.data.settings);
        setMessage(json.data.message ?? json.message ?? "설정이 저장되었습니다.");
      } else {
        setMessage(json.message ?? "저장에 실패했습니다.");
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
          플랫폼이 프로젝트 DB를 자동으로 준비합니다.
        </p>
      ) : null}
      {inlineCopy ? (
        <p
          style={{
            margin: "0 0 12px 0",
            fontSize: 12,
            color: projectDbStatus === "FAILED" ? "#b45309" : "#334155",
            lineHeight: 1.55,
          }}
        >
          {inlineCopy}
        </p>
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
        <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>데이터베이스명</span>
          <input
            value={String(settings.databaseStoreName ?? "")}
            disabled={!canEdit || busy !== null}
            onChange={(e) => setSettings((s) => ({ ...s, databaseStoreName: e.target.value }))}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", maxWidth: 360 }}
          />
        </label>
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
        {showRetry ? (
          <button
            type="button"
            disabled={!canEdit || busy !== null}
            onClick={() => void persistSettings()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #b45309",
              background: "#fff",
              color: "#b45309",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {busy === "save" ? "재시도 중…" : "다시 시도"}
          </button>
        ) : null}
      </div>
      {message ? (
        <p style={{ marginTop: 10, fontSize: 12, color: "#334155", lineHeight: 1.5 }} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
