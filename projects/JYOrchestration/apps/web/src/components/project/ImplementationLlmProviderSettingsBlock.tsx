"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImplementationLlmProviderConfigV1 } from "@/lib/prototype/implementationLlmProviderConfigWire";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

type Props = Readonly<{
  projectId: string;
  canEdit: boolean;
  initialConfig: ImplementationLlmProviderConfigV1 | null;
  hasProjectApiKey: boolean;
  onSaved?: (config: ImplementationLlmProviderConfigV1 | null) => void;
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
  const [draft, setDraft] = useState<ImplementationLlmProviderConfigV1>(() =>
    props.initialConfig ? { ...props.initialConfig } : defaultDraft(),
  );
  const [busy, setBusy] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(props.initialConfig ? { ...props.initialConfig } : defaultDraft());
  }, [props.initialConfig]);

  const save = useCallback(async () => {
    if (!props.canEdit) return;
    setBusy(true);
    setTestMessage(null);
    try {
      const encoded = encodeURIComponent(props.projectId);
      const res = await credentialsIncludeFetch(`/api/projects/${encoded}/execution-setup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          implementationLlmProviderConfig: {
            ...draft,
            scope: "project",
            enabled: true,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { implementationLlmProviderConfig?: ImplementationLlmProviderConfigV1 | null };
      };
      if (!json.success) {
        setTestMessage(json.message ?? "저장에 실패했습니다.");
        return;
      }
      const saved = json.data?.implementationLlmProviderConfig ?? draft;
      props.onSaved?.(saved ?? null);
      setTestMessage("저장했습니다.");
    } finally {
      setBusy(false);
    }
  }, [draft, props]);

  const testConnection = useCallback(async () => {
    setBusy(true);
    setTestMessage(null);
    try {
      const encoded = encodeURIComponent(props.projectId);
      const res = await credentialsIncludeFetch(
        `/api/projects/${encoded}/implementation-llm-provider/test`,
        { method: "POST" },
      );
      const json = (await res.json()) as { success?: boolean; message?: string };
      setTestMessage(json.message ?? (json.success ? "연결 성공" : "연결 실패"));
    } finally {
      setBusy(false);
    }
  }, [props.projectId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#334155" }}>AI 개발자 LLM Provider (구현단계)</div>
      <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        Working Queue Intent·Preview Vision 분석에 사용합니다. API Key는 위 OpenAI Planner Key(프로젝트) 또는 사용자
        기본 키를 사용합니다.
      </p>
      {!props.hasProjectApiKey ? (
        <p style={{ margin: 0, fontSize: 12, color: "#b45309" }}>
          프로젝트 Planner API Key가 없으면 사용자 기본 OpenAI 키가 사용됩니다.
        </p>
      ) : null}
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
            setDraft((d) => ({
              ...d,
              capabilities: { ...d.capabilities, vision: e.target.checked },
            }))
          }
        />
        <span>Vision 사용 가능</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <input
          type="checkbox"
          disabled={!props.canEdit || busy}
          checked={draft.capabilities.jsonMode !== false}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              capabilities: { ...d.capabilities, jsonMode: e.target.checked },
            }))
          }
        />
        <span>JSON structured output</span>
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={!props.canEdit || busy}
          onClick={() => void save()}
          style={{ padding: "6px 12px", fontSize: 12, fontWeight: 700 }}
        >
          Provider 설정 저장
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void testConnection()}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          연결 테스트
        </button>
      </div>
      {testMessage ? (
        <p style={{ margin: 0, fontSize: 12, color: "#475569" }} data-testid="impl-llm-provider-status">
          {testMessage}
        </p>
      ) : null}
    </div>
  );
}
