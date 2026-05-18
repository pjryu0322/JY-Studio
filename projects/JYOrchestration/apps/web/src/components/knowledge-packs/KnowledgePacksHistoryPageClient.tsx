"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import type { KnowledgePack } from "@/lib/knowledge-packs/types";

type HistoryItem = {
  id: string;
  knowledgePackId: string;
  versionId: string | null;
  action: string;
  actorId: string;
  actorType: string;
  summary: string;
  createdAt: string;
  packName: string;
};

export function KnowledgePacksHistoryPageClient() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [packOptions, setPackOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPackId, setFilterPackId] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterActorType, setFilterActorType] = useState("");

  const loadPacks = useCallback(async () => {
    try {
      const r = await fetch("/api/knowledge-packs?agent=ALL&category=ALL");
      const j = (await r.json()) as { ok?: boolean; packs?: KnowledgePack[] };
      if (j.ok && Array.isArray(j.packs)) {
        setPackOptions(j.packs.filter((p) => p.id.startsWith("kp_")).map((p) => ({ id: p.id, name: p.name })));
      }
    } catch {
      /* noop */
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filterPackId.trim()) q.set("packId", filterPackId.trim());
      if (filterAction.trim()) q.set("action", filterAction.trim());
      if (filterActorType.trim()) q.set("actorType", filterActorType.trim());
      const r = await fetch(`/api/knowledge-packs/history?${q.toString()}`);
      const j = (await r.json()) as { ok?: boolean; items?: HistoryItem[] };
      if (j.ok && Array.isArray(j.items)) setItems(j.items);
      else setItems([]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filterPackId, filterAction, filterActorType]);

  useEffect(() => {
    void loadPacks();
  }, [loadPacks]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const empty = !loading && items.length === 0;

  return (
    <div style={{ flex: 1, minWidth: 0, padding: "16px 14px 80px", maxWidth: 1100, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0, flex: "1 1 auto" }}>지식팩 변경 이력</h1>
        <Link href="/knowledge-packs" prefetch={false} style={{ fontSize: 13, fontWeight: 700, color: t.accentTealFg }}>
          ← 목록
        </Link>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, alignItems: "flex-end" }}>
        <label style={{ fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          지식팩
          <select
            value={filterPackId}
            onChange={(e) => setFilterPackId(e.target.value)}
            style={{ display: "block", marginTop: 4, minWidth: 200, padding: 8, borderRadius: 8, border: `1px solid ${t.border}` }}
          >
            <option value="">전체</option>
            {packOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          action
          <input
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{ display: "block", marginTop: 4, padding: 8, borderRadius: 8, border: `1px solid ${t.border}`, minWidth: 140 }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          actorType
          <input
            value={filterActorType}
            onChange={(e) => setFilterActorType(e.target.value)}
            style={{ display: "block", marginTop: 4, padding: 8, borderRadius: 8, border: `1px solid ${t.border}`, minWidth: 120 }}
          />
        </label>
        <button
          type="button"
          onClick={() => void loadHistory()}
          style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          조회
        </button>
      </div>

      {loading ? (
        <div style={{ color: t.textMuted }}>불러오는 중…</div>
      ) : empty ? (
        <div style={{ padding: 24, border: `1px dashed ${t.border}`, borderRadius: t.radiusLg, color: t.textMuted }}>
          아직 등록/수정된 DB 지식팩 이력이 없습니다.
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${t.border}`, borderRadius: t.radiusMd }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["시각", "지식팩", "action", "actorType", "actorId", "versionId", "packId", "summary"].map((h) => (
                  <th key={h} style={{ padding: 10, textAlign: "left", fontWeight: 900, borderBottom: `1px solid ${t.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={{ padding: 10, borderBottom: `1px solid ${t.border}`, whiteSpace: "nowrap" }}>{new Date(it.createdAt).toLocaleString()}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${t.border}` }}>{it.packName}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${t.border}` }}>{it.action}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${t.border}` }}>{it.actorType}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${t.border}`, overflowWrap: "anywhere" }}>{it.actorId}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${t.border}`, overflowWrap: "anywhere" }}>{it.versionId ?? "—"}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${t.border}`, overflowWrap: "anywhere" }}>{it.knowledgePackId}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${t.border}`, overflowWrap: "anywhere" }}>{it.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
