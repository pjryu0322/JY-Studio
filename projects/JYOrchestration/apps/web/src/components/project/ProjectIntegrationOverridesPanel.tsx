"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

type OwnerInt = {
  id: string;
  provider: string;
  capability: string;
  displayName: string | null;
  isDefault: boolean;
  maskedPreview: string | null;
};

type Bindings = Record<string, string | null>;

type CapabilityRow = {
  capability: string;
  status: string;
  bindingUserIntegrationId: string | null;
  effectiveUserIntegrationId: string | null;
  source: "PROJECT_OVERRIDE" | "USER_DEFAULT" | null;
  provider: string | null;
  maskedPreview: string | null;
  displayName: string | null;
  message: string | null;
};

const CAP_LABEL: Record<string, string> = {
  LLM: "LLM",
  CODE_AGENT: "CODE_AGENT",
  SCM: "SCM",
  DEPLOY: "DEPLOY",
};

function sourceLabel(source: CapabilityRow["source"], status: string): string {
  if (status === "INVALID_OVERRIDE") return "오류(무효한 override)";
  if (status === "MISSING") return "프로젝트 override 없음";
  if (source === "PROJECT_OVERRIDE") return "프로젝트 override";
  if (source === "USER_DEFAULT") return "기본 설정 사용";
  return "기본 설정 사용";
}

export function ProjectIntegrationOverridesPanel({
  projectId,
  canEdit,
}: {
  readonly projectId: string;
  readonly canEdit: boolean;
}) {
  const pid = projectId.trim();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ownerIntegrations, setOwnerIntegrations] = useState<OwnerInt[]>([]);
  const [bindings, setBindings] = useState<Bindings>({});
  const [capabilityRows, setCapabilityRows] = useState<CapabilityRow[]>([]);

  const load = useCallback(async () => {
    if (!pid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await credentialsIncludeFetch(`/api/projects/${encodeURIComponent(pid)}/integrations`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: {
          ownerIntegrations?: OwnerInt[];
          bindings?: Bindings;
          capabilityRows?: CapabilityRow[];
        };
        message?: string;
      };
      if (!res.ok || !json.success || !json.data) {
        setMessage(json.message || "연동 설정을 불러오지 못했습니다.");
        setOwnerIntegrations([]);
        setBindings({});
        setCapabilityRows([]);
        return;
      }
      setOwnerIntegrations(json.data.ownerIntegrations ?? []);
      setBindings(json.data.bindings ?? {});
      setCapabilityRows(json.data.capabilityRows ?? []);
    } catch {
      setMessage("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    void load();
  }, [load]);

  const optionsForCap = useCallback(
    (cap: string) => {
      const filtered = ownerIntegrations.filter((o) => o.capability === cap);
      return [
        { id: "", label: "(프로젝트 미지정 — 사용자 기본·레거시 체인)" },
        ...filtered.map((o) => ({
          id: o.id,
          label: `${o.provider}${o.displayName ? ` · ${o.displayName}` : ""}${o.isDefault ? " [기본]" : ""}${o.maskedPreview ? ` (${o.maskedPreview})` : ""}`,
        })),
      ];
    },
    [ownerIntegrations]
  );

  const save = useCallback(async () => {
    if (!pid || !canEdit) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await credentialsIncludeFetch(`/api/projects/${encodeURIComponent(pid)}/integrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bindings }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setMessage(json.message || "저장에 실패했습니다.");
        return;
      }
      setMessage(json.message || "저장했습니다.");
      await load();
    } catch {
      setMessage("요청 중 오류");
    } finally {
      setSaving(false);
    }
  }, [pid, canEdit, bindings, load]);

  const rowByCap = useMemo(() => new Map(capabilityRows.map((r) => [r.capability, r])), [capabilityRows]);

  if (!pid) return null;

  return (
    <section
      style={{
        marginBottom: 20,
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#fafafa",
      }}
    >
      <h2 style={{ margin: "0 0 8px 0", fontSize: 15, fontWeight: 900, color: "#0f172a" }}>Integrations (프로젝트)</h2>
      <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        프로젝트별로 기본 AI/Code Agent/SCM을 바꾸고 싶을 때만 설정합니다. 비워두면 사용자 기본 설정 또는 실행
        환경 설정을 사용합니다. 일반적인 자동 생성 작업에서는 별도 설정이 필요하지 않습니다. 연동 등록은{" "}
        <Link href="/integrations" style={{ color: "#2563eb", fontWeight: 800 }}>
          Settings → Integrations
        </Link>
        에서 할 수 있습니다.
      </p>
      {loading ? (
        <p style={{ fontSize: 13, color: "#64748b" }}>불러오는 중…</p>
      ) : (
        <>
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff", borderRadius: 8 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "8px 10px", color: "#64748b" }}>Capability</th>
                  <th style={{ padding: "8px 10px", color: "#64748b" }}>Provider</th>
                  <th style={{ padding: "8px 10px", color: "#64748b" }}>Source</th>
                  <th style={{ padding: "8px 10px", color: "#64748b" }}>표시</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(CAP_LABEL).map((cap) => {
                  const r = rowByCap.get(cap);
                  const warn = r?.status === "INVALID_OVERRIDE";
                  return (
                    <tr key={cap} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 800 }}>{CAP_LABEL[cap]}</td>
                      <td style={{ padding: "8px 10px", color: warn ? "#b45309" : "#0f172a" }}>{r?.provider ?? "—"}</td>
                      <td style={{ padding: "8px 10px" }}>{r ? sourceLabel(r.source, r.status) : "—"}</td>
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>
                        {r?.maskedPreview ?? ""}
                        {r?.displayName ? ` · ${r.displayName}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {capabilityRows.some((r) => r.status === "INVALID_OVERRIDE") ? (
            <p style={{ fontSize: 12, fontWeight: 700, color: "#b45309", margin: "0 0 12px 0" }}>
              일부 프로젝트 override가 무효합니다. Integrations에서 연결을 확인하거나, 아래에서 override를 비우거나
              올바른 연동을 선택하세요.
            </p>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.keys(CAP_LABEL).map((cap) => (
              <label key={cap} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>{CAP_LABEL[cap]} — 연동 선택</span>
                <select
                  disabled={!canEdit || saving}
                  value={bindings[cap] ?? ""}
                  onChange={(e) => setBindings((b) => ({ ...b, [cap]: e.target.value || null }))}
                  style={{
                    maxWidth: 520,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                    background: "#fff",
                  }}
                >
                  {optionsForCap(cap).map((o) => (
                    <option key={o.id || "__none"} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {canEdit ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                style={{
                  alignSelf: "flex-start",
                  marginTop: 6,
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#0d9488",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: saving ? "wait" : "pointer",
                }}
              >
                연동 선택 저장
              </button>
            ) : (
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>편집 권한이 없어 저장할 수 없습니다.</p>
            )}
          </div>
        </>
      )}
      {message ? (
        <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, fontWeight: 700, color: "#334155" }} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
