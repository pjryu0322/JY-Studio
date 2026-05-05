"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { WorkspaceAiMemberAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { PlatformAiMember } from "@/lib/ai/platformAiMembers";
import { MEDIA_QUERY } from "@/components/ui/breakpoints";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

function capLabel(c: string): string {
  if (c === "LLM") return "LLM";
  if (c === "CODE") return "CODE";
  if (c === "SECURITY") return "SECURITY";
  return c;
}

export function PlatformAiMembersAdminListClient() {
  const isNarrow = useMediaQuery(MEDIA_QUERY.workflowNavNarrow);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<PlatformAiMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await credentialsIncludeFetch("/api/admin/platform-ai-members");
      const json = (await res.json()) as { success?: boolean; data?: { members?: PlatformAiMember[] }; message?: string };
      if (res.status === 403) {
        setAllowed(false);
        setRows([]);
        return;
      }
      if (!res.ok || !json.success || !Array.isArray(json.data?.members)) {
        setAllowed(res.ok);
        setRows([]);
        setError(json.message || "목록을 불러오지 못했습니다.");
        return;
      }
      setAllowed(true);
      setRows(json.data!.members!);
    } catch {
      setAllowed(false);
      setError("네트워크 오류가 발생했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (allowed === false && !loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 48px" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 900, color: "#0f172a" }}>AI 멤버 관리</h1>
        <p style={{ color: "#b91c1c", fontWeight: 700 }}>이 페이지는 플랫폼 관리자만 이용할 수 있습니다.</p>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 10, lineHeight: 1.55 }}>
          설정 메뉴에서「설정 메뉴 모드 → 관리자」를 선택한 뒤, 플랫폼 관리자 계정으로 접속해 주세요.
        </p>
        <Link href="/" style={{ display: "inline-block", marginTop: 16, fontWeight: 800, color: "#2563eb" }}>
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: isNarrow ? "12px 12px 40px" : "20px 16px 48px" }}>
      <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: isNarrow ? 18 : 22, fontWeight: 900, color: "#0f172a" }}>AI 멤버 관리</h1>
        <Link
          href="/"
          style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}
        >
          홈
        </Link>
      </div>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px", lineHeight: 1.55 }}>
        플랫폼 공통 페르소나·하네스입니다. 프로젝트에서는 멤버 활성화만 구분합니다(MVP에서 프로젝트 화면은 변경하지 않음).
      </p>

      {loading ? (
        <p style={{ color: "#64748b" }}>불러오는 중…</p>
      ) : error ? (
        <p style={{ color: "#b91c1c" }}>{error}</p>
      ) : isNarrow ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((m) => (
            <div
              key={m.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "#fff",
                padding: "14px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <WorkspaceAiMemberAvatar memberId={m.id as WorkspaceAiMemberId} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    {m.role} · {capLabel(m.capability)} · {m.defaultEngine}
                  </div>
                </div>
              </div>
              <Link
                href={`/settings/ai-members/${encodeURIComponent(m.id)}`}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #0d9488",
                  background: "#fff",
                  color: "#0f766e",
                  fontWeight: 800,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                상세보기
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th style={{ padding: "10px 8px", fontWeight: 800, color: "#64748b", width: 56 }}>아바타</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>이름</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>역할</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>Capability</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>기본 엔진</th>
                <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b", whiteSpace: "nowrap" }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 8px", verticalAlign: "middle" }}>
                    <WorkspaceAiMemberAvatar memberId={m.id as WorkspaceAiMemberId} size={36} />
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 800 }}>{m.name}</td>
                  <td style={{ padding: "10px 12px", color: "#475569" }}>{m.role}</td>
                  <td style={{ padding: "10px 12px", color: "#475569" }}>{capLabel(m.capability)}</td>
                  <td style={{ padding: "10px 12px", color: "#475569" }}>{m.defaultEngine}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <Link
                      href={`/settings/ai-members/${encodeURIComponent(m.id)}`}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #0d9488",
                        background: "#fff",
                        color: "#0f766e",
                        fontWeight: 800,
                        fontSize: 12,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      상세보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
