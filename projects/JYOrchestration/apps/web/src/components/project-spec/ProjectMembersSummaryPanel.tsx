"use client";

import Link from "next/link";
import type { ProjectMemberUiRow } from "@/components/project-spec/memberUiTypes";
import { projectRoleLabelKr } from "@/lib/project/unifiedMemberPresentation";
import type { ProjectRole } from "@/lib/auth/roles";

const ROLE_ORDER: ProjectRole[] = ["OWNER", "EDITOR", "REVIEWER", "VIEWER"];

export function ProjectMembersSummaryPanel({
  projectId,
  members,
}: {
  readonly projectId: string;
  readonly members: ProjectMemberUiRow[];
}) {
  const total = members.length;
  const humanCount = members.filter((m) => m.memberType === "HUMAN").length;
  const aiCount = members.filter((m) => m.memberType === "AI").length;
  const byRole = members.reduce<Partial<Record<ProjectRole, number>>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});
  const roleParts = ROLE_ORDER.map((r) => {
    const n = byRole[r];
    return n ? `${projectRoleLabelKr(r)} ${n}명` : null;
  }).filter(Boolean);

  const adminHref = `/project-admin/members?projectId=${encodeURIComponent(projectId)}`;

  return (
    <section
      data-testid="project-members-summary-panel"
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
      }}
    >
      <h2 style={{ margin: "0 0 10px 0", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>멤버 요약</h2>
      <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
        초대·역할·AI 멤버 설정은 <strong>프로젝트 관리 &gt; 멤버</strong>에서만 변경합니다. 여기서는 현재 구성만 빠르게 확인합니다.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>총 멤버</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{total}</div>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>사용자</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{humanCount}</div>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>AI</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{aiCount}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#334155", marginBottom: 14, lineHeight: 1.55 }}>
        <strong style={{ color: "#0f172a" }}>역할 분포</strong>
        <div style={{ marginTop: 6 }}>{roleParts.length ? roleParts.join(" · ") : "—"}</div>
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>최근 변경 시각은 멤버 관리 화면에서 확인할 수 있습니다.</div>
      <Link
        data-testid="project-members-summary-admin-link"
        href={adminHref}
        style={{
          display: "inline-block",
          padding: "10px 18px",
          borderRadius: 10,
          border: "1px solid #2563eb",
          background: "#2563eb",
          color: "#fff",
          fontWeight: 800,
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        멤버 관리로 이동
      </Link>
    </section>
  );
}
