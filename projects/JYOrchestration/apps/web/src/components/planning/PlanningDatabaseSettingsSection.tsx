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
  projectDatabaseUserSaveResultMessage,
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const repoHint = String(gitRepoName ?? "").trim();
  const usageMode = resolveDatabaseUsageMode(settings);
  const dbUsageEnabled = isDatabaseUsageEnabledMode(usageMode) && settings.enabled;
  const projectDbStatus = readProjectDatabaseLifecycleStatus(settings.projectDbStatus);
  const showRetry = dbUsageEnabled && projectDbStatus === "FAILED";

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
            usageMode: "ENABLED_PROJECT_DATABASE",
            usageSelectionCommitted: true,
            connectionStatus: "NOT_CONFIGURED",
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
        data?: { settings?: PlanningDatabaseSettingsV1; message?: string };
      };
      if (json.data?.settings) {
        setSettings(json.data.settings);
        setMessage(json.data.message ?? projectDatabaseUserSaveResultMessage(json.data.settings));
      } else {
        setMessage(json.message ?? "저장에 실패했습니다.");
      }
    } finally {
      setBusy(null);
    }
  };

  const projectDbName = String(settings.projectDbName ?? "").trim();

  return (
    <div data-testid="planning-database-settings-section" style={{ maxWidth: 720 }}>
      <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b" }}>
        현재 상태: {projectDatabaseUserSectionHeadline(settings)}
      </p>
      <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
        데이터베이스를 사용하면 플랫폼이 프로젝트 DB를 자동으로 준비합니다. 사용하지 않으면 JSON 샘플데이터로
        구현단계를 진행합니다.
      </p>
      {usageMode === "UNSELECTED" ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
          데이터베이스 사용 여부를 선택해 주세요.
        </p>
      ) : null}
      {usageMode === "DISABLED_JSON_SAMPLE" ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#334155", lineHeight: 1.55 }}>
          샘플데이터 방식: JSON 샘플데이터. 구현단계에서는 JSON 샘플데이터로 화면과 기능 흐름을 확인합니다.
          PostgreSQL 프로젝트 DB는 생성되지 않습니다.
        </p>
      ) : null}
      {dbUsageEnabled && projectDbStatus === "FAILED" ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#b45309", lineHeight: 1.55 }}>
          프로젝트 데이터베이스를 준비하지 못했습니다. 플랫폼 관리자 설정 또는 PostgreSQL 권한 확인이 필요합니다.
        </p>
      ) : null}
      {dbUsageEnabled && projectDbStatus !== "FAILED" ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
          {projectDbStatus === "CREATED"
            ? "구현단계 진입 시 샘플 저장소가 자동 생성됩니다."
            : "플랫폼이 프로젝트 데이터베이스를 자동으로 준비합니다. 구현단계 진입 시 샘플 저장소가 생성되고, 검토단계 전환 시 테스트 저장소가 생성됩니다."}
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
      {dbUsageEnabled && projectDbName && advancedOpen ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b" }}>
          고급 정보 · 프로젝트 DB: {projectDbName}
        </p>
      ) : null}
      {dbUsageEnabled && projectDbName ? (
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          style={{
            marginBottom: 12,
            padding: 0,
            border: "none",
            background: "transparent",
            color: "#2563eb",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {advancedOpen ? "고급 정보 접기" : "고급 정보"}
        </button>
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
