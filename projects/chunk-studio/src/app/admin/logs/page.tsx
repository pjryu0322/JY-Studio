"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: string;
  action: string;
  jobId?: string | null;
  level?: "info" | "warn" | "error";
  detail?: Record<string, unknown>;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/logs?limit=300");
        if (!res.ok) throw new Error("Failed to load logs");
        const payload = (await res.json()) as { logs?: AuditLogEntry[] };
        if (!cancelled) setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      } catch {
        if (!cancelled) setError("로그를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((log) => map.set(log.category, (map.get(log.category) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchCategory = categoryFilter === "all" || log.category === categoryFilter;
      const level = log.level ?? "info";
      const matchLevel = levelFilter === "all" || level === levelFilter;
      const matchSearch =
        !q ||
        log.action.toLowerCase().includes(q) ||
        log.category.toLowerCase().includes(q) ||
        (log.jobId ?? "").toLowerCase().includes(q);
      return matchCategory && matchLevel && matchSearch;
    });
  }, [logs, categoryFilter, levelFilter, search]);

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "20px" }}>
      <section style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>Admin Audit Logs</h1>
          <Link href="/admin" style={{ fontSize: 13, textDecoration: "none", color: "#1d4ed8" }}>
            관리자 화면으로
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {grouped.map(([category, count]) => (
            <span
              key={category}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: 12,
                color: "#334155",
                background: "#fff",
              }}
            >
              {category}: {count}
            </span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 180px", gap: 8 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="action / category / job 검색"
            style={filterInput}
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={filterInput}>
            <option value="all">all categories</option>
            {grouped.map(([category]) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} style={filterInput}>
            <option value="all">all levels</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: "#64748b" }}>로그를 불러오는 중입니다.</div>
        ) : error ? (
          <div style={{ fontSize: 13, color: "#b91c1c" }}>{error}</div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ fontSize: 13, color: "#64748b" }}>기록된 로그가 없습니다.</div>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#334155" }}>
                  <th style={th}>time</th>
                  <th style={th}>category</th>
                  <th style={th}>action</th>
                  <th style={th}>job</th>
                  <th style={th}>level</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={td}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td style={td}>{log.category}</td>
                    <td style={td}>{log.action}</td>
                    <td style={td}>{log.jobId ?? "-"}</td>
                    <td style={td}>{log.level ?? "info"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const th = {
  textAlign: "left",
  fontWeight: 700,
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
} as const;

const td = {
  padding: "8px 12px",
  color: "#0f172a",
  verticalAlign: "top",
} as const;

const filterInput = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  fontSize: 12,
  padding: "8px 10px",
  color: "#0f172a",
} as const;
