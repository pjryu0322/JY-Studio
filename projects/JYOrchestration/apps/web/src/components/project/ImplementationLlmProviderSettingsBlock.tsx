"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ImplementationLlmProviderConfigV1 } from "@/lib/prototype/implementationLlmProviderConfigWire";
import { patchExecutionSetup } from "@/lib/prototype/executionSetupClient";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

export type ImplementationLlmProviderScopeMode = "inherit_user" | "project_override";

type Props = Readonly<{
  projectId: string;
  canEdit: boolean;
  initialProjectConfig: ImplementationLlmProviderConfigV1 | null;
  hasProjectApiKey: boolean;
  hasUserDefaultApiKey?: boolean;
  openaiPlannerApiKeyMasked?: string | null;
  onSaved?: (config: ImplementationLlmProviderConfigV1 | null) => void;
  onNotice?: (message: string, tone?: "success" | "error") => void;
}>;

const defaultDraft = (): ImplementationLlmProviderConfigV1 => ({
  version: "implementation_llm_provider_config_v1",
  provider: "openai",
  model: "gpt-4o-mini",
  scope: "project",
  capabilities: { text: true, vision: true, jsonMode: true },
  enabled: true,
});

export function ImplementationLlmProviderSettingsBlock(props: Props) {
  const [scopeMode, setScopeMode] = useState<ImplementationLlmProviderScopeMode>(() =>
    props.initialProjectConfig ? "project_override" : "inherit_user",
  );
  const [userDefaultConfig, setUserDefaultConfig] = useState<ImplementationLlmProviderConfigV1 | null>(null);
  const [draft, setDraft] = useState<ImplementationLlmProviderConfigV1>(() =>
    props.initialProjectConfig ? { ...props.initialProjectConfig } : defaultDraft(),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await credentialsIncludeFetch("/api/me/implementation-llm-provider-config");
        const json = (await res.json()) as { data?: { config?: ImplementationLlmProviderConfigV1 | null } };
        setUserDefaultConfig(json.data?.config ?? null);
      } catch {
        setUserDefaultConfig(null);
      }
    })();
  }, []);

  useEffect(() => {
    const mode: ImplementationLlmProviderScopeMode = props.initialProjectConfig ? "project_override" : "inherit_user";
    setScopeMode(mode);
    if (props.initialProjectConfig) {
      setDraft({ ...props.initialProjectConfig });
    } else if (userDefaultConfig) {
      setDraft({ ...userDefaultConfig, scope: "user" });
    } else {
      setDraft(defaultDraft());
    }
  }, [props.initialProjectConfig, userDefaultConfig]);

  const configNeeded = useMemo(() => {
    if (scopeMode === "project_override") return !props.initialProjectConfig?.model && !draft.model.trim();
    return !userDefaultConfig?.model;
  }, [scopeMode, props.initialProjectConfig, userDefaultConfig, draft.model]);

  const notify = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      props.onNotice?.(message, tone);
    },
    [props],
  );

  const saveUserDefault = useCallback(async () => {
    if (!props.canEdit) return;
    setBusy(true);
    try {
      const res = await credentialsIncludeFetch("/api/me/implementation-llm-provider-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { ...draft, scope: "user", enabled: true, updatedAt: new Date().toISOString() },
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string; data?: { config?: ImplementationLlmProviderConfigV1 | null } };
      if (!json.success) {
        notify(json.message ?? "사용자 기본 Provider 저장에 실패했습니다.", "error");
        return;
      }
      setUserDefaultConfig(json.data?.config ?? null);
      notify("사용자 기본 Provider 설정을 저장했습니다.");
    } finally {
      setBusy(false);
    }
  }, [draft, notify, props.canEdit]);

  const saveProjectOverride = useCallback(async () => {
    if (!props.canEdit) return;
    setBusy(true);
    try {
      const { res, json } = await patchExecutionSetup(props.projectId, {
        implementationLlmProviderConfig: {
          ...draft,
          scope: "project",
          enabled: true,
          updatedAt: new Date().toISOString(),
        },
      });
      if (!res.ok || !json.success || !json.data) {
        notify(json.message ?? "프로젝트 Provider 저장에 실패했습니다.", "error");
        return;
      }
      props.onSaved?.(json.data.implementationLlmProviderConfig ?? null);
      notify("프로젝트 Provider 설정을 저장했습니다.");
    } finally {
      setBusy(false);
    }
  }, [draft, notify, props]);

  const clearProjectOverride = useCallback(async () => {
    if (!props.canEdit) return;
    setBusy(true);
    try {
      const { res, json } = await patchExecutionSetup(props.projectId, {
        implementationLlmProviderConfig: null,
      });
      if (!res.ok || !json.success || !json.data) {
        notify(json.message ?? "프로젝트 override 해제에 실패했습니다.", "error");
        return;
      }
      setScopeMode("inherit_user");
      props.onSaved?.(null);
      notify("프로젝트 override를 해제했습니다. 사용자 기본 설정을 사용합니다.");
    } finally {
      setBusy(false);
    }
  }, [notify, props]);

  const testConnection = useCallback(async () => {
    setBusy(true);
    try {
      const res = await credentialsIncludeFetch("/api/prototype/implementation/provider-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: props.projectId,
          scope: scopeMode === "project_override" ? "project" : "user",
          providerConfig: draft,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; errorMessage?: string; model?: string };
      if (json.ok) {
        notify(json.model ? `연결 테스트 성공 (${json.model})` : "연결 테스트 성공");
      } else {
        notify(json.errorMessage ?? "연결 테스트 실패", "error");
      }
    } finally {
      setBusy(false);
    }
  }, [draft, notify, props.projectId, scopeMode]);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}
      data-testid="implementation-llm-provider-settings"
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>AI 개발자 LLM Provider 설정</div>
      {configNeeded ? (
        <p style={{ margin: 0, fontSize: 12, color: "#b45309", fontWeight: 700 }}>Provider 설정이 필요합니다.</p>
      ) : null}
      <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <legend style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>사용 범위</legend>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="radio"
            name="impl-llm-scope"
            disabled={!props.canEdit || busy}
            checked={scopeMode === "inherit_user"}
            onChange={() => setScopeMode("inherit_user")}
          />
          사용자 기본 설정 사용
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <input
            type="radio"
            name="impl-llm-scope"
            disabled={!props.canEdit || busy}
            checked={scopeMode === "project_override"}
            onChange={() => setScopeMode("project_override")}
          />
          이 프로젝트에만 override
        </label>
      </fieldset>
      <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        API Key: 프로젝트 Planner Key{" "}
        {props.hasProjectApiKey
          ? `(저장됨${props.openaiPlannerApiKeyMasked ? ` · ${props.openaiPlannerApiKeyMasked}` : ""})`
          : "미설정"}
        {props.hasUserDefaultApiKey ? " · 사용자 기본 키 사용 가능" : ""}
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: "#475569" }}>Provider</span>
        <select
          disabled={!props.canEdit || busy}
          value={draft.provider ?? "openai"}
          onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value }))}
          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
        >
          <option value="openai">OpenAI</option>
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: "#475569" }}>Model</span>
        <input
          disabled={!props.canEdit || busy}
          value={draft.model}
          onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
          placeholder="gpt-4o-mini"
          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <input
          type="checkbox"
          disabled={!props.canEdit || busy}
          checked={draft.capabilities.vision === true}
          onChange={(e) =>
            setDraft((d) => ({ ...d, capabilities: { ...d.capabilities, vision: e.target.checked } }))
          }
        />
        <span>Vision 지원</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <input
          type="checkbox"
          disabled={!props.canEdit || busy}
          checked={draft.capabilities.jsonMode !== false}
          onChange={(e) =>
            setDraft((d) => ({ ...d, capabilities: { ...d.capabilities, jsonMode: e.target.checked } }))
          }
        />
        <span>JSON structured output</span>
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {scopeMode === "project_override" ? (
          <button type="button" disabled={!props.canEdit || busy} onClick={() => void saveProjectOverride()}>
            프로젝트 override 저장
          </button>
        ) : (
          <button type="button" disabled={!props.canEdit || busy} onClick={() => void saveUserDefault()}>
            사용자 기본으로 저장
          </button>
        )}
        {scopeMode === "project_override" && props.initialProjectConfig ? (
          <button type="button" disabled={!props.canEdit || busy} onClick={() => void clearProjectOverride()}>
            override 해제
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => void testConnection()}>
          연결 테스트
        </button>
      </div>
    </div>
  );
}
