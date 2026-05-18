"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import {
  INTEGRATION_REGISTRATION_CARDS,
  INTEGRATION_UI_SECTIONS,
} from "@/lib/integrations/integrationRegistration";

type Row = {
  id: string;
  provider: string;
  capability: string;
  status: string;
  displayName: string | null;
  isDefault: boolean;
  maskedPreview: string | null;
  updatedAt: string;
};

const cardByKey = new Map<string, (typeof INTEGRATION_REGISTRATION_CARDS)[number]>(
  INTEGRATION_REGISTRATION_CARDS.map((c) => [c.key, c])
);

export default function IntegrationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [secrets, setSecrets] = useState<Record<string, string>>(() =>
    Object.fromEntries(INTEGRATION_REGISTRATION_CARDS.map((c) => [c.key, ""]))
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await credentialsIncludeFetch("/api/me/integrations");
      const json = (await res.json()) as { success?: boolean; data?: Row[] };
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setRows([]);
        return;
      }
      setRows(json.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const register = useCallback(
    async (cardKey: string) => {
      const card = cardByKey.get(cardKey);
      if (!card) return;
      const s = (secrets[cardKey] ?? "").trim();
      if (!s) {
        setMsg("키를 입력하세요.");
        return;
      }
      setBusyKey(cardKey);
      setMsg(null);
      try {
        const res = await credentialsIncludeFetch("/api/me/integrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: card.provider, capability: card.capability, secret: s }),
        });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          setMsg(json.message || "저장에 실패했습니다.");
          return;
        }
        setMsg(json.message || "저장했습니다.");
        setSecrets((prev) => ({ ...prev, [cardKey]: "" }));
        await load();
      } catch {
        setMsg("요청 중 오류");
      } finally {
        setBusyKey(null);
      }
    },
    [secrets, load]
  );

  const setDefault = useCallback(
    async (id: string) => {
      setBusyKey(`def:${id}`);
      setMsg(null);
      try {
        const res = await credentialsIncludeFetch(`/api/me/integrations/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: true }),
        });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          setMsg(json.message || "기본값 설정에 실패했습니다.");
          return;
        }
        setMsg(json.message || "이 연동을 해당 capability의 기본으로 설정했습니다.");
        await load();
      } catch {
        setMsg("요청 중 오류");
      } finally {
        setBusyKey(null);
      }
    },
    [load]
  );

  const remove = useCallback(
    async (id: string) => {
      if (!confirm("이 연동을 삭제할까요?")) return;
      setBusyKey(`del:${id}`);
      setMsg(null);
      try {
        const res = await credentialsIncludeFetch(`/api/me/integrations/${encodeURIComponent(id)}`, { method: "DELETE" });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          setMsg(json.message || "삭제에 실패했습니다.");
          return;
        }
        setMsg(json.message || "삭제했습니다.");
        await load();
      } catch {
        setMsg("요청 중 오류");
      } finally {
        setBusyKey(null);
      }
    },
    [load]
  );

  const busy = busyKey !== null;

  const sections = useMemo(() => INTEGRATION_UI_SECTIONS, []);

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ fontSize: 14, fontWeight: 700, color: "#2563eb", textDecoration: "none" }}>
          ← 홈
        </Link>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: "0 0 8px 0" }}>Settings · Integrations</h1>
      <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
        사용자 단위로 외부 자격 증명을 등록합니다. 키는 서버에서 AES-256-GCM으로 암호화되며 목록에는 마스킹만 표시됩니다. capability별 <strong>기본 연동</strong>을 지정하면 프로젝트에서 override가 없을 때 그 연동이 사용됩니다. 프로젝트별로 다른 연동을 쓰려면{" "}
        <strong style={{ color: "#334155" }}>실행 환경</strong>의 Integrations에서 capability별로 선택하세요.
      </p>

      {msg ? (
        <p style={{ marginBottom: 14, fontSize: 13, fontWeight: 700, color: "#334155" }} role="status">
          {msg}
        </p>
      ) : null}

      <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 14px 0", lineHeight: 1.5 }}>
        환경 변수{" "}
        <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>JY_INTEGRATIONS_MASTER_KEY</code>{" "}
        (32바이트 이상 권장, base64 또는 hex)가 서버에 있어야 모든 연동이 저장됩니다.
      </p>

      {sections.map((section) => (
        <div key={section.id} style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: "0 0 12px 0", borderBottom: "2px solid #e2e8f0", paddingBottom: 6 }}>
            {section.title}
          </h2>
          {section.cardKeys.map((cardKey) => {
            const card = cardByKey.get(cardKey);
            if (!card) return null;
            return (
              <section
                key={card.key}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "16px 18px",
                  marginBottom: 14,
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>{card.title}</h3>
                  {!card.mvpConnected ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#92400e",
                        background: "#fffbeb",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      NOT_IMPLEMENTED
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#065f46",
                        background: "#ecfdf5",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      연결됨(MVP)
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px 0", lineHeight: 1.5 }}>{card.description}</p>
                <textarea
                  value={secrets[card.key] ?? ""}
                  onChange={(e) => setSecrets((prev) => ({ ...prev, [card.key]: e.target.value }))}
                  placeholder={card.placeholder}
                  rows={3}
                  disabled={busy}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 13,
                    marginBottom: 10,
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void register(card.key)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "#0d9488",
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: 13,
                    cursor: busy ? "wait" : "pointer",
                  }}
                >
                  {busyKey === card.key ? "등록 중…" : "연결 / 등록"}
                </button>
              </section>
            );
          })}
        </div>
      ))}

      <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", background: "#fff" }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 900 }}>등록된 연동</h2>
        {loading ? (
          <p style={{ color: "#64748b" }}>불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 14 }}>
            아직 등록된 연동이 없습니다. Integrations에서 먼저 OpenAI·Cursor·GitHub 등을 연결해 주세요.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {rows.map((r) => (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid #f1f5f9",
                  fontSize: 14,
                }}
              >
                <div>
                  <strong style={{ color: "#0f172a" }}>
                    {r.provider} / {r.capability}
                  </strong>
                  {r.displayName ? (
                    <span style={{ color: "#475569", marginLeft: 8 }}>({r.displayName})</span>
                  ) : null}
                  <span style={{ color: "#64748b", marginLeft: 8 }}>{r.maskedPreview ?? "—"}</span>
                  <span style={{ color: "#94a3b8", marginLeft: 8, fontSize: 12 }}>{r.status}</span>
                  {r.isDefault ? (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        fontWeight: 900,
                        color: "#1d4ed8",
                        background: "#eff6ff",
                        padding: "2px 8px",
                        borderRadius: 6,
                      }}
                    >
                      기본
                    </span>
                  ) : null}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {!r.isDefault ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setDefault(r.id)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid #bfdbfe",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: busy ? "wait" : "pointer",
                      }}
                    >
                      {busyKey === `def:${r.id}` ? "설정 중…" : "기본으로"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(r.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: busy ? "wait" : "pointer",
                    }}
                  >
                    {busyKey === `del:${r.id}` ? "삭제 중…" : "삭제"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
