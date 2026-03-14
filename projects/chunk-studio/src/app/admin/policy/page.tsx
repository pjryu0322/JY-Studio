"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ExportPolicy {
  ragEnabled: boolean;
  graphEnabled: boolean;
  includeMetadata: boolean;
  allowedFormats: Array<"json" | "jsonl" | "csv">;
  lastUpdatedAt: string;
}

export default function AdminPolicyPage() {
  const [policy, setPolicy] = useState<ExportPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/admin/export-policy");
      const payload = (await res.json()) as { policy?: ExportPolicy };
      setPolicy(payload.policy ?? null);
    };
    void load();
  }, []);

  const toggleFormat = (fmt: "json" | "jsonl" | "csv") => {
    if (!policy) return;
    const exists = policy.allowedFormats.includes(fmt);
    const next = exists
      ? policy.allowedFormats.filter((v) => v !== fmt)
      : [...policy.allowedFormats, fmt];
    setPolicy({ ...policy, allowedFormats: next });
  };

  const save = async () => {
    if (!policy) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/admin/export-policy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ragEnabled: policy.ragEnabled,
        graphEnabled: policy.graphEnabled,
        includeMetadata: policy.includeMetadata,
        allowedFormats: policy.allowedFormats,
      }),
    });
    const payload = (await res.json()) as { policy?: ExportPolicy; error?: string };
    if (!res.ok) {
      setMessage(payload.error ?? "저장 실패");
    } else {
      setPolicy(payload.policy ?? policy);
      setMessage("저장되었습니다.");
    }
    setSaving(false);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 20 }}>
      <section style={{ maxWidth: 760, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>Export Policy</h1>
          <Link href="/admin" style={{ fontSize: 13, textDecoration: "none", color: "#1d4ed8" }}>
            관리자 화면으로
          </Link>
        </div>
        {!policy ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>정책을 불러오는 중입니다.</div>
        ) : (
          <div style={{ border: "1px solid #dbe3f1", borderRadius: 12, background: "#fff", padding: 14, display: "grid", gap: 10 }}>
            <label style={rowLabel}>
              <span>RAG export enabled</span>
              <input type="checkbox" checked={policy.ragEnabled} onChange={(e) => setPolicy({ ...policy, ragEnabled: e.target.checked })} />
            </label>
            <label style={rowLabel}>
              <span>Graph export enabled</span>
              <input type="checkbox" checked={policy.graphEnabled} onChange={(e) => setPolicy({ ...policy, graphEnabled: e.target.checked })} />
            </label>
            <label style={rowLabel}>
              <span>Include metadata</span>
              <input type="checkbox" checked={policy.includeMetadata} onChange={(e) => setPolicy({ ...policy, includeMetadata: e.target.checked })} />
            </label>
            <div style={{ display: "grid", gap: 6 }}>
              <strong style={{ fontSize: 13, color: "#334155" }}>Allowed Formats</strong>
              <div style={{ display: "flex", gap: 8 }}>
                {(["json", "jsonl", "csv"] as const).map((fmt) => (
                  <label key={fmt} style={{ ...rowLabel, gap: 6, border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px" }}>
                    <input
                      type="checkbox"
                      checked={policy.allowedFormats.includes(fmt)}
                      onChange={() => toggleFormat(fmt)}
                    />
                    <span>{fmt}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => void save()} disabled={saving} style={saveBtn}>
              {saving ? "저장 중..." : "정책 저장"}
            </button>
            {policy.lastUpdatedAt && (
              <div style={{ fontSize: 11, color: "#64748b" }}>
                last updated: {new Date(policy.lastUpdatedAt).toLocaleString()}
              </div>
            )}
            {message && <div style={{ fontSize: 12, color: "#1e40af" }}>{message}</div>}
          </div>
        )}
      </section>
    </main>
  );
}

const rowLabel = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
  color: "#334155",
} as const;

const saveBtn = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 13,
  padding: "8px 10px",
  cursor: "pointer",
} as const;
