"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ImplementationLlmProviderConfigV1,
  ImplementationLlmProviderTestResponse,
} from "@/lib/prototype/implementationLlmProviderConfigWire";
import { patchExecutionSetup } from "@/lib/prototype/executionSetupClient";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

export type ImplementationLlmProviderScopeMode = "inherit_user" | "project_override";

type Props = Readonly<{
  projectId: string;
  canEdit: boolean;
  initialProjectConfig: ImplementationLlmProviderConfigV1 | null;
  hasProjectApiKey: boolean;
  openaiPlannerApiKeyMasked?: string | null;
  onSaved?: (config: ImplementationLlmProviderConfigV1 | null) => void;
  onProjectApiKeySaved?: (hasKey: boolean, masked: string | null) => void;
  onNotice?: (message: string, tone?: "success" | "error") => void;
}>;

const defaultDraft = (): ImplementationLlmProviderConfigV1 => ({
  version: "implementation_llm_provider_config_v1",
  provider: "openai",
  model: "gpt-4o-mini",
  scope: "user",
  apiKeyRef: "user_default_openai",
  capabilities: { text: true, vision: true, jsonMode: true },
  enabled: true,
});

export function ImplementationLlmProviderSettingsBlock(props: Props) {
  const [scopeMode, setScopeMode] = useState<ImplementationLlmProviderScopeMode>(() =>
    props.initialProjectConfig ? "project_override" : "inherit_user",
  );
  const [userDefaultConfig, setUserDefaultConfig] = useState<ImplementationLlmProviderConfigV1 | null>(null);
  const [hasUserDefaultApiKey, setHasUserDefaultApiKey] = useState(false);
  const [userApiKeyMasked, setUserApiKeyMasked] = useState<string | null>(null);
  const [userApiKeyInput, setUserApiKeyInput] = useState("");
  const [projectApiKeyInput, setProjectApiKeyInput] = useState("");
  const [draft, setDraft] = useState<ImplementationLlmProviderConfigV1>(() =>
    props.initialProjectConfig ? { ...props.initialProjectConfig } : defaultDraft(),
  );
  const [busy, setBusy] = useState(false);

  const reloadUserState = useCallback(async () => {
    try {
      const res = await credentialsIncludeFetch("/api/me/implementation-llm-provider-config");
      const json = (await res.json()) as {
        data?: {
          config?: ImplementationLlmProviderConfigV1 | null;
          hasDefaultOpenaiApiKey?: boolean;
          defaultOpenaiApiKeyMasked?: string | null;
        };
      };
      setUserDefaultConfig(json.data?.config ?? null);
      setHasUserDefaultApiKey(Boolean(json.data?.hasDefaultOpenaiApiKey));
      setUserApiKeyMasked(json.data?.defaultOpenaiApiKeyMasked ?? null);
    } catch {
      setUserDefaultConfig(null);
      setHasUserDefaultApiKey(false);
      setUserApiKeyMasked(null);
    }
  }, []);

  useEffect(() => {
    void reloadUserState();
  }, [reloadUserState]);

  useEffect(() => {
    const mode: ImplementationLlmProviderScopeMode = props.initialProjectConfig ? "project_override" : "inherit_user";
    setScopeMode(mode);
    if (props.initialProjectConfig) {
      setDraft({ ...props.initialProjectConfig, apiKeyRef: "project_openai_planner" });
    } else if (userDefaultConfig) {
      setDraft({ ...userDefaultConfig, scope: "user", apiKeyRef: "user_default_openai" });
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
      const payload: Record<string, unknown> = {
        implementationLlmProviderConfig: {
          ...draft,
          scope: "user",
          apiKeyRef: "user_default_openai",
          enabled: true,
          updatedAt: new Date().toISOString(),
        },
      };
      const keyTrim = userApiKeyInput.trim();
      if (keyTrim) payload.openaiApiKey = keyTrim;

      const res = await credentialsIncludeFetch("/api/me/implementation-llm-provider-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!json.success) {
        notify(json.message ?? "사용자 기본 Provider 저장에 실패했습니다.", "error");
        return;
      }
      setUserApiKeyInput("");
      await reloadUserState();
      notify(json.message ?? "사용자 기본 Provider 설정을 저장했습니다.");
    } finally {
      setBusy(false);
    }
  }, [draft, notify, props.canEdit, reloadUserState, userApiKeyInput]);

  const clearUserDefaultApiKey = useCallback(async () => {
    if (!props.canEdit) return;
    setBusy(true);
    try {
      const res = await credentialsIncludeFetch("/api/me/implementation-llm-provider-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearOpenaiApiKey: true }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!json.success) {
        notify(json.message ?? "API Key 삭제에 실패했습니다.", "error");
        return;
      }
      setUserApiKeyInput("");
      await reloadUserState();
      notify("사용자 기본 LLM API Key를 삭제했습니다.");
    } finally {
      setBusy(false);
    }
  }, [notify, props.canEdit, reloadUserState]);

  const saveProjectOverride = useCallback(async () => {
    if (!props.canEdit) return;
    setBusy(true);
    try {
      const patch: Parameters<typeof patchExecutionSetup>[1] = {
        implementationLlmProviderConfig: {
          ...draft,
          scope: "project",
          apiKeyRef: "project_openai_planner",
          enabled: true,
          updatedAt: new Date().toISOString(),
        },
      };
      const keyTrim = projectApiKeyInput.trim();
      if (keyTrim) patch.openaiPlannerApiKey = keyTrim;

      const { res, json } = await patchExecutionSetup(props.projectId, patch);
      if (!res.ok || !json.success || !json.data) {
        notify(json.message ?? "프로젝트 Provider 저장에 실패했습니다.", "error");
        return;
      }
      setProjectApiKeyInput("");
      props.onSaved?.(json.data.implementationLlmProviderConfig ?? null);
      if (keyTrim) {
        props.onProjectApiKeySaved?.(true, json.data.openaiPlannerApiKeyMasked ?? null);
      }
      notify("프로젝트 Provider 설정을 저장했습니다.");
    } finally {
      setBusy(false);
    }
  }, [draft, notify, projectApiKeyInput, props]);

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
      const encoded = encodeURIComponent(props.projectId);
      const res = await credentialsIncludeFetch(
        `/api/projects/${encoded}/implementation-llm-provider/test`,
        { method: "POST" },
      );
      const json = (await res.json()) as ImplementationLlmProviderTestResponse;
      if (!res.ok || json.success !== true) {
        notify(json.message || "Provider 연결 테스트에 실패했습니다.", "error");
        return;
      }
      const model = json.data?.model?.trim();
      notify(model ? `연결 테스트 성공 (${model})` : json.message || "연결 테스트 성공");
    } finally {
      setBusy(false);
    }
  }, [notify, props.projectId]);

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

      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>
        <div>
          <strong>사용자 기본 LLM API Key:</strong>{" "}
          {hasUserDefaultApiKey ? `설정됨${userApiKeyMasked ? ` · ${userApiKeyMasked}` : ""}` : "미설정"}
          <span style={{ display: "block", fontSize: 11 }}>
            프로젝트 override가 없을 때 AI 개발자 LLM/Preview/CodeTask 정제에 사용됩니다.
          </span>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>프로젝트 LLM API Key:</strong>{" "}
          {props.hasProjectApiKey
            ? `설정됨${props.openaiPlannerApiKeyMasked ? ` · ${props.openaiPlannerApiKeyMasked}` : ""}`
            : "미설정"}
          <span style={{ display: "block", fontSize: 11 }}>
            이 프로젝트 override 시 AI 개발자 LLM 호출에 우선 사용됩니다.
          </span>
        </div>
      </div>

      {scopeMode === "inherit_user" ? (
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: "#475569" }}>새 사용자 기본 API Key</span>
          <input
            type="password"
            autoComplete="off"
            disabled={!props.canEdit || busy}
            value={userApiKeyInput}
            onChange={(e) => setUserApiKeyInput(e.target.value)}
            placeholder="sk-…"
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" disabled={!props.canEdit || busy} onClick={() => void saveUserDefault()}>
              사용자 기본 저장
            </button>
            {hasUserDefaultApiKey ? (
              <button type="button" disabled={!props.canEdit || busy} onClick={() => void clearUserDefaultApiKey()}>
                사용자 API Key 삭제
              </button>
            ) : null}
          </div>
        </label>
      ) : (
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: "#475569" }}>새 프로젝트 LLM API Key (선택)</span>
          <input
            type="password"
            autoComplete="off"
            disabled={!props.canEdit || busy}
            value={projectApiKeyInput}
            onChange={(e) => setProjectApiKeyInput(e.target.value)}
            placeholder="sk-…"
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </label>
      )}

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
          <>
            <button type="button" disabled={!props.canEdit || busy} onClick={() => void saveProjectOverride()}>
              프로젝트 override 저장
            </button>
            {props.initialProjectConfig ? (
              <button type="button" disabled={!props.canEdit || busy} onClick={() => void clearProjectOverride()}>
                override 해제
              </button>
            ) : null}
          </>
        ) : null}
        <button type="button" disabled={busy} onClick={() => void testConnection()} data-testid="impl-llm-provider-test">
          연결 테스트
        </button>
      </div>
    </div>
  );
}
