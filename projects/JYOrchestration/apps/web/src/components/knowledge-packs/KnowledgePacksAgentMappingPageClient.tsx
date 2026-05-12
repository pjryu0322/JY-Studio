"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

const USAGE_MODES = ["REFERENCE", "PROMPT_INJECTION", "REVIEW_CHECKLIST", "SECURITY_GATE"] as const;

const AGENT_ROLES = [
  "AI_DEVELOPER",
  "AI_PLANNER",
  "AI_ANALYST",
  "AI_ARCHITECT",
  "AI_DESIGNER",
  "AI_REVIEWER",
  "AI_SECURITY",
] as const;

const CATEGORIES = ["GRID", "AUTH", "SECURITY", "UI", "API", "DATA", "INTEGRATION"] as const;

type MappingRow = {
  agentRole: string;
  category: string;
  enabled: boolean;
  usageMode: string;
  priority: number;
};

function rowKey(r: MappingRow): string {
  return `${r.agentRole}\t${r.category}`;
}

export function KnowledgePacksAgentMappingPageClient() {
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/knowledge-packs/agent-category-mappings");
      const j = (await r.json()) as { ok?: boolean; mappings?: MappingRow[] };
      if (!j.ok || !j.mappings) {
        setErr("매핑을 불러오지 못했습니다.");
        setRows([]);
        return;
      }
      setRows(
        j.mappings.map((m) => ({
          agentRole: m.agentRole,
          category: m.category,
          enabled: m.enabled,
          usageMode: m.usageMode,
          priority: Number(m.priority),
        }))
      );
    } catch {
      setErr("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const existingKeys = useMemo(() => new Set(rows.map(rowKey)), [rows]);

  const addRow = () => {
    for (const agentRole of AGENT_ROLES) {
      for (const category of CATEGORIES) {
        const candidate: MappingRow = { agentRole, category, enabled: true, usageMode: "REFERENCE", priority: 50 };
        if (!existingKeys.has(rowKey(candidate))) {
          setRows((prev) => [...prev, candidate]);
          return;
        }
      }
    }
    setErr("추가할 수 있는 빈 Agent·카테고리 조합이 없습니다.");
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/knowledge-packs/agent-category-mappings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: rows }),
      });
      const j = (await r.json()) as { ok?: boolean; message?: string; mappings?: MappingRow[] };
      if (!j.ok) {
        setErr(j.message ?? "저장 실패");
        return;
      }
      if (j.mappings) {
        setRows(
          j.mappings.map((m) => ({
            agentRole: m.agentRole,
            category: m.category,
            enabled: m.enabled,
            usageMode: m.usageMode,
            priority: Number(m.priority),
          }))
        );
      }
      setMsg("저장되었습니다.");
    } catch {
      setErr("네트워크 오류");
    } finally {
      setSaving(false);
    }
  };

  const cell: CSSProperties = { padding: 8, fontSize: 12, borderBottom: `1px solid ${t.border}` };
  const th: CSSProperties = { ...cell, fontWeight: 900, textAlign: "left", background: "#f8fafc" };

  return (
    <div style={{ flex: 1, minWidth: 0, padding: "16px 14px 80px", maxWidth: 960, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, flex: "1 1 auto" }}>Agent ↔ 카테고리 매핑</h1>
        <Link href="/knowledge-packs" prefetch={false} style={{ fontSize: 13, fontWeight: 700, color: t.accentTealFg }}>
          ← 목록
        </Link>
      </div>

      <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.55, margin: "0 0 12px" }}>
        지식팩은 카테고리에 속하고, AI Agent가 어떤 카테고리를 어떻게 사용할지는 이 설정에서 관리합니다. PROMPT_INJECTION은 향후 Agent 프롬프트 생성 시 사용됩니다. SECURITY_GATE는 AI보안관 점검
        기준으로 사용됩니다.
      </p>

      {err ? <div style={{ padding: 10, borderRadius: 8, background: "#fef2f2", color: "#b91c1c", marginBottom: 10 }}>{err}</div> : null}
      {msg ? <div style={{ padding: 10, borderRadius: 8, background: "#ecfdf5", color: t.accentTealFg, marginBottom: 10 }}>{msg}</div> : null}

      {loading ? (
        <div style={{ color: t.textMuted }}>불러오는 중…</div>
      ) : (
        <>
          <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radiusMd, marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={th}>Agent</th>
                  <th style={th}>카테고리</th>
                  <th style={th}>enabled</th>
                  <th style={th}>usageMode</th>
                  <th style={th}>priority</th>
                  <th style={{ ...th, width: 72 }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={`${rowKey(row)}-${idx}`}>
                    <td style={cell}>
                      <select
                        value={row.agentRole}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((prev) => {
                            const next = [...prev];
                            const nextRow = { ...next[idx], agentRole: v };
                            if (prev.some((r, i) => i !== idx && rowKey(r) === rowKey(nextRow))) return prev;
                            next[idx] = nextRow;
                            return next;
                          });
                        }}
                        style={{ maxWidth: "100%", fontSize: 12 }}
                      >
                        {AGENT_ROLES.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={cell}>
                      <select
                        value={row.category}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((prev) => {
                            const next = [...prev];
                            const nextRow = { ...next[idx], category: v };
                            if (prev.some((r, i) => i !== idx && rowKey(r) === rowKey(nextRow))) return prev;
                            next[idx] = nextRow;
                            return next;
                          });
                        }}
                        style={{ maxWidth: "100%", fontSize: 12 }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={cell}>
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(e) => setRows((p) => p.map((r, i) => (i === idx ? { ...r, enabled: e.target.checked } : r)))}
                      />
                    </td>
                    <td style={cell}>
                      <select
                        value={row.usageMode}
                        onChange={(e) => setRows((p) => p.map((r, i) => (i === idx ? { ...r, usageMode: e.target.value } : r)))}
                        style={{ fontSize: 12 }}
                      >
                        {USAGE_MODES.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={cell}>
                      <input
                        type="number"
                        value={row.priority}
                        onChange={(e) => setRows((p) => p.map((r, i) => (i === idx ? { ...r, priority: Number(e.target.value) } : r)))}
                        style={{ width: 72, fontSize: 12 }}
                      />
                    </td>
                    <td style={cell}>
                      <button type="button" onClick={() => removeRow(idx)} style={{ fontSize: 12, cursor: "pointer" }}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              onClick={addRow}
              style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              행 추가
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: t.accentTeal,
                color: "#fff",
                fontWeight: 800,
                cursor: saving ? "wait" : "pointer",
              }}
            >
              저장
            </button>
          </div>
        </>
      )}
    </div>
  );
}
