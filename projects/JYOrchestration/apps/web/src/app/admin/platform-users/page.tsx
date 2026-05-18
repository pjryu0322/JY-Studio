"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PlatformUserDto = {
  id: string;
  email: string;
  name: string;
  globalRole: string;
  platformRole: string;
  accountStatus: string;
  planTier: string;
  lastLoginAt: string | null;
  humanProjectCount: number;
  createdAt: string;
  updatedAt: string;
};

function accountStatusLabel(s: string): string {
  return s === "SUSPENDED" ? "정지" : "활성";
}

function planLabel(tier: string): string {
  const t = String(tier ?? "").trim().toLowerCase();
  if (t === "free") return "무료";
  if (t === "pro" || t === "team") return "유료";
  return tier || "—";
}

export default function AdminPlatformUsersPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<PlatformUserDto[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}&limit=100` : "?limit=100";
      const res = await fetch(`/api/admin/platform-users${qs}`, { credentials: "include" });
      const json = (await res.json()) as { success?: boolean; message?: string; data?: PlatformUserDto[] };
      if (res.status === 403) {
        setAllowed(false);
        setRows([]);
        setError(null);
        return;
      }
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setAllowed(true);
        setRows([]);
        setError(json.message || "목록을 불러오지 못했습니다.");
        return;
      }
      setAllowed(true);
      setRows(json.data);
    } catch {
      setAllowed(false);
      setError("네트워크 오류가 발생했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q.trim() ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  if (allowed === false && !loading) {
    return (
      <main style={{ padding: 24, maxWidth: 880, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>관리자 콘솔 · 플랫폼 사용자</h1>
        <p style={{ color: "#b91c1c", marginTop: 12 }}>이 페이지는 플랫폼 관리자만 볼 수 있습니다.</p>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
          프로젝트에 사람을 초대하려면 각 프로젝트의{" "}
          <Link href="/requirements" style={{ color: "#2563eb", fontWeight: 700 }}>
            멤버 관리
          </Link>
          를 사용하세요. (프로젝트 멤버 ≠ 플랫폼 사용자)
        </p>
        <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
          상단 설정(톱니바퀴)에서 메뉴 모드를 <strong>관리자</strong>로 바꾼 뒤 다시 시도해 보세요.
        </p>
        <Link href="/" style={{ display: "inline-block", marginTop: 16, fontWeight: 700, color: "#2563eb" }}>
          홈으로
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" style={{ fontSize: 14, fontWeight: 700, color: "#2563eb", textDecoration: "none" }}>
          ← 홈
        </Link>
      </div>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: "0 0 6px 0", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>관리자 콘솔 · 플랫폼 사용자</h1>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
          로그인 가능한 <strong>전역 계정</strong> 목록입니다(읽기). 역할은 <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>USER</code> /{" "}
          <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>ADMIN</code> /{" "}
          <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>SUPER_ADMIN</code> 입니다.
        </p>
      </header>

      <div style={{ marginBottom: 16 }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 또는 이메일 검색"
          aria-label="플랫폼 사용자 검색"
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            fontSize: 14,
          }}
        />
      </div>

      {loading ? <p style={{ color: "#64748b" }}>불러오는 중…</p> : null}
      {error && allowed ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {!loading && allowed && rows.length === 0 ? (
        <p style={{ color: "#64748b" }}>등록된 사용자가 없습니다.</p>
      ) : null}

      {!loading && allowed && rows.length > 0 ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "auto",
            boxShadow: "0 4px 18px rgba(15, 23, 42, 0.06)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 860 }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th style={{ padding: "12px 14px", fontWeight: 800, color: "#475569" }}>이름</th>
                <th style={{ padding: "12px 14px", fontWeight: 800, color: "#475569" }}>이메일</th>
                <th style={{ padding: "12px 14px", fontWeight: 800, color: "#475569" }}>상태</th>
                <th style={{ padding: "12px 14px", fontWeight: 800, color: "#475569" }}>플랜</th>
                <th style={{ padding: "12px 14px", fontWeight: 800, color: "#475569", whiteSpace: "nowrap" }}>프로젝트 수</th>
                <th style={{ padding: "12px 14px", fontWeight: 800, color: "#475569", whiteSpace: "nowrap" }}>최근 접속</th>
                <th style={{ padding: "12px 14px", fontWeight: 800, color: "#475569" }}>역할</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "#0f172a" }}>{u.name}</td>
                  <td style={{ padding: "12px 14px", color: "#334155" }}>{u.email}</td>
                  <td style={{ padding: "12px 14px", color: u.accountStatus === "SUSPENDED" ? "#b91c1c" : "#0f766e", fontWeight: 700 }}>
                    {accountStatusLabel(u.accountStatus)}
                  </td>
                  <td style={{ padding: "12px 14px", color: "#334155" }}>{planLabel(u.planTier)}</td>
                  <td style={{ padding: "12px 14px", color: "#334155", textAlign: "right" }}>{u.humanProjectCount}</td>
                  <td style={{ padding: "12px 14px", color: "#64748b", whiteSpace: "nowrap" }}>
                    {u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })
                      : "—"}
                  </td>
                  <td style={{ padding: "12px 14px", color: "#64748b" }}>{u.platformRole}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
