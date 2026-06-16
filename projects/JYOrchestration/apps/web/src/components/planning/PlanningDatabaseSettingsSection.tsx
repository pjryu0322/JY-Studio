"use client";

import { useCallback, useEffect, useState } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import {
  defaultPlanningDatabaseSettingsV1,
  type PlanningDatabaseSettingsV1,
  type PlanningDatabaseSslMode,
} from "@/lib/planning/planningDatabaseSettingsV1";
import { syncPlanningDatabaseSettingsStoreNames } from "@/lib/planning/planningDatabaseStoreNamingSync";

type Props = Readonly<{
  readonly projectId: string;
  readonly canEdit: boolean;
  readonly gitRepoName?: string | null;
}>;

export function PlanningDatabaseSettingsSection({ projectId, canEdit, gitRepoName }: Props) {
  const [settings, setSettings] = useState<PlanningDatabaseSettingsV1>(defaultPlanningDatabaseSettingsV1());
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"load" | "save" | "test" | null>("load");
  const [message, setMessage] = useState<string | null>(null);
  const repoHint = String(gitRepoName ?? "").trim();

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
        preserveManualStoreName: Boolean(prev.databaseStoreName?.trim()),
      }),
    );
  }, [repoHint, projectId, busy]);

  const patch = (partial: Partial<PlanningDatabaseSettingsV1>) => {
    setSettings((s) => ({ ...s, ...partial }));
  };

  const handleSave = async () => {
    setBusy("save");
    setMessage(null);
    try {
      const res = await credentialsIncludeFetch(
        `/api/projects/${encodeURIComponent(projectId.trim())}/planning/database-settings/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings, ...(password.trim() ? { password: password.trim() } : {}) }),
        },
      );
      const json = (await res.json()) as { success?: boolean; message?: string; data?: { settings?: PlanningDatabaseSettingsV1 } };
      if (json.success && json.data?.settings) {
        setSettings(json.data.settings);
        setPassword("");
        setMessage("데이터베이스 설정을 저장했습니다.");
      } else {
        setMessage(json.message ?? "저장에 실패했습니다.");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    setBusy("test");
    setMessage(null);
    try {
      const res = await credentialsIncludeFetch(
        `/api/projects/${encodeURIComponent(projectId.trim())}/planning/database-settings/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings, ...(password.trim() ? { password: password.trim() } : {}) }),
        },
      );
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { settings?: PlanningDatabaseSettingsV1; message?: string };
      };
      if (json.data?.settings) setSettings(json.data.settings);
      setMessage(json.data?.message ?? json.message ?? (json.success ? "연결 성공" : "연결 실패"));
    } finally {
      setBusy(null);
    }
  };

  const storeNameField = (label: string, key: keyof Pick<
    PlanningDatabaseSettingsV1,
    "databaseStoreName" | "implementationSchemaName" | "reviewSchemaName"
  >) => (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{label}</span>
      <input
        value={String(settings[key] ?? "")}
        disabled={!canEdit || !settings.enabled}
        onChange={(e) => patch({ [key]: e.target.value } as Partial<PlanningDatabaseSettingsV1>)}
        style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
      />
    </label>
  );

  return (
    <div data-testid="planning-database-settings-section" style={{ maxWidth: 720 }}>
      <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
        구현단계에서 샘플데이터를 JSON 파일이 아니라 데이터 저장소에 저장해 Preview에서 등록·수정·삭제까지 확인할 수
        있도록 설정합니다. GitHub Pages Preview는 PostgreSQL에 직접 연결하지 않고 Platform Runtime API(데이터 연결)를
        사용합니다.
      </p>
      {repoHint ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#334155" }}>
          Git Repository 기준 저장소명: <strong>{repoHint}</strong>
        </p>
      ) : null}
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={settings.enabled}
          disabled={!canEdit || busy !== null}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        데이터베이스 사용
      </label>
      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>DB 종류</span>
          <input value="PostgreSQL" disabled style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Host</span>
          <input
            value={settings.host}
            disabled={!canEdit || !settings.enabled}
            onChange={(e) => patch({ host: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Port</span>
          <input
            type="number"
            value={settings.port}
            disabled={!canEdit || !settings.enabled}
            onChange={(e) => patch({ port: Number(e.target.value) || 5432 })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Database</span>
          <input
            value={settings.database}
            disabled={!canEdit || !settings.enabled}
            onChange={(e) => patch({ database: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Username</span>
          <input
            value={settings.username}
            disabled={!canEdit || !settings.enabled}
            onChange={(e) => patch({ username: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Password</span>
          <input
            type="password"
            value={password}
            disabled={!canEdit || !settings.enabled}
            placeholder={settings.hasPassword ? "저장된 비밀번호 (변경 시에만 입력)" : "비밀번호"}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
            autoComplete="new-password"
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>SSL Mode</span>
          <select
            value={settings.sslMode}
            disabled={!canEdit || !settings.enabled}
            onChange={(e) => patch({ sslMode: e.target.value as PlanningDatabaseSslMode })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          >
            <option value="PREFER">PREFER</option>
            <option value="REQUIRE">REQUIRE</option>
            <option value="DISABLE">DISABLE</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Runtime API Base URL</span>
          <input
            value={settings.runtimeApiBaseUrl ?? ""}
            disabled={!canEdit || !settings.enabled}
            placeholder="비워두면 플랫폼 기본값"
            onChange={(e) => patch({ runtimeApiBaseUrl: e.target.value || null })}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
        </label>
        {storeNameField("프로젝트 데이터 저장소명", "databaseStoreName")}
        {storeNameField("구현단계 샘플 저장소", "implementationSchemaName")}
        {storeNameField("검토단계 테스트 저장소", "reviewSchemaName")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          disabled={!canEdit || busy !== null}
          onClick={() => void handleSave()}
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
        <button
          type="button"
          disabled={!canEdit || busy !== null || !settings.enabled}
          onClick={() => void handleTest()}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #0f766e",
            background: "#0d9488",
            color: "#fff",
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          {busy === "test" ? "테스트 중…" : "연결 테스트"}
        </button>
        <span style={{ fontSize: 12, color: settings.connectionStatus === "READY" ? "#15803d" : "#64748b" }}>
          상태: {settings.connectionStatus}
        </span>
      </div>
      {message ? (
        <p style={{ marginTop: 10, fontSize: 12, color: "#334155", lineHeight: 1.5 }} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
