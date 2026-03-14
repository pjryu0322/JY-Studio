"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface SeedItem {
  id: string;
  name: string;
  description?: string;
  family: "guide_manual" | "public_rfp" | "policy_manual" | "unknown_generic";
  createdAt: string;
}

export default function AdminSeedsPage() {
  const [seeds, setSeeds] = useState<SeedItem[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [family, setFamily] = useState<SeedItem["family"]>("guide_manual");
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/seed-datasets");
    const payload = (await res.json()) as { seeds?: SeedItem[] };
    setSeeds(Array.isArray(payload.seeds) ? payload.seeds : []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setMessage(null);
    const res = await fetch("/api/admin/seed-datasets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim(), family }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(payload.error ?? "생성 실패");
      return;
    }
    setName("");
    setDescription("");
    await load();
    setMessage("시드 데이터셋이 추가되었습니다.");
  };

  const remove = async (id: string) => {
    await fetch(`/api/admin/seed-datasets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 20 }}>
      <section style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>Seed Dataset Management</h1>
          <Link href="/admin" style={{ fontSize: 13, textDecoration: "none", color: "#1d4ed8" }}>
            관리자 화면으로
          </Link>
        </div>
        <div style={{ border: "1px solid #dbe3f1", borderRadius: 12, background: "#fff", padding: 12, display: "grid", gap: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="dataset name" style={input} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="description" style={input} />
          <select value={family} onChange={(e) => setFamily(e.target.value as SeedItem["family"])} style={input}>
            <option value="guide_manual">guide_manual</option>
            <option value="public_rfp">public_rfp</option>
            <option value="policy_manual">policy_manual</option>
            <option value="unknown_generic">unknown_generic</option>
          </select>
          <button type="button" onClick={() => void create()} style={button}>
            시드 데이터셋 추가
          </button>
          {message && <div style={{ fontSize: 12, color: "#1e40af" }}>{message}</div>}
        </div>
        <div style={{ border: "1px solid #dbe3f1", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={th}>name</th>
                <th style={th}>family</th>
                <th style={th}>created</th>
                <th style={th}>action</th>
              </tr>
            </thead>
            <tbody>
              {seeds.map((seed) => (
                <tr key={seed.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={td}>{seed.name}</td>
                  <td style={td}>{seed.family}</td>
                  <td style={td}>{new Date(seed.createdAt).toLocaleString()}</td>
                  <td style={td}>
                    <button type="button" onClick={() => void remove(seed.id)} style={dangerBtn}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {seeds.length === 0 && (
                <tr>
                  <td style={td} colSpan={4}>
                    시드 데이터셋이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const input = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
} as const;

const button = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#eff6ff",
  color: "#1d4ed8",
  padding: "8px 10px",
  fontSize: 12,
  cursor: "pointer",
} as const;

const dangerBtn = {
  border: "1px solid #fecaca",
  borderRadius: 8,
  background: "#fef2f2",
  color: "#b91c1c",
  padding: "4px 8px",
  fontSize: 11,
  cursor: "pointer",
} as const;

const th = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid #e2e8f0",
} as const;

const td = {
  padding: "8px 10px",
  color: "#0f172a",
} as const;
