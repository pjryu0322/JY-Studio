"use client";

import { useCallback, useEffect, useState } from "react";

export type PlatformUserRow = { id: string; email: string; name: string };

export function PlatformUserSearchCombobox({
  onPick,
  disabled,
}: {
  readonly onPick: (u: PlatformUserRow) => void;
  readonly disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PlatformUserRow[]>([]);
  const [busy, setBusy] = useState(false);

  const search = useCallback(async (query: string) => {
    const t = query.trim();
    if (t.length < 2) {
      setRows([]);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/users/search?q=${encodeURIComponent(t)}&limit=15`, { credentials: "include" });
      const json = (await res.json()) as { success?: boolean; data?: PlatformUserRow[] };
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setRows([]);
        return;
      }
      setRows(json.data);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void search(q);
    }, 280);
    return () => clearTimeout(t);
  }, [q, search]);

  return (
    <div style={{ position: "relative" }}>
      <input
        type="search"
        value={q}
        disabled={disabled}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름 또는 이메일 검색 (2자 이상)"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #d4d4d8",
          fontSize: 14,
        }}
      />
      {busy ? <div style={{ fontSize: 11, color: "#71717a", marginTop: 4 }}>검색 중…</div> : null}
      {rows.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: "6px 0 0 0",
            padding: 0,
            maxHeight: 200,
            overflowY: "auto",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            background: "#fff",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          }}
        >
          {rows.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onPick(u);
                  setQ("");
                  setRows([]);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: 0,
                  borderBottom: "1px solid #f4f4f5",
                  background: "#fff",
                  cursor: disabled ? "default" : "pointer",
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 700 }}>{u.name}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{u.email}</div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
