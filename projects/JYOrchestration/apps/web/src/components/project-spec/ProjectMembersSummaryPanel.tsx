"use client";

import { useMemo, useState } from "react";
import type { ProjectMemberUiRow } from "@/components/project-spec/memberUiTypes";
import { RequirementsMemberInviteModal } from "@/components/requirements/RequirementsMemberInviteModal";
import { projectRoleLabelKr } from "@/lib/project/unifiedMemberPresentation";
import type { ProjectRole } from "@/lib/auth/roles";

const ROLE_ORDER: ProjectRole[] = ["OWNER", "EDITOR", "REVIEWER", "VIEWER"];

export function ProjectMembersSummaryPanel({
  projectId,
  members,
  canInvite,
  onMembersChanged,
}: {
  readonly projectId: string;
  readonly members: ProjectMemberUiRow[];
  /** false면 초대 UI는 숨기고 목록만 표시 */
  readonly canInvite: boolean;
  readonly onMembersChanged: () => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
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

  const existingHumanUserIds = useMemo(
    () => new Set(members.filter((m) => m.memberType === "HUMAN" && m.userId).map((m) => m.userId as string)),
    [members]
  );

  const sortedMembers = useMemo(() => {
    const roleRank = (r: ProjectRole) => ROLE_ORDER.indexOf(r);
    return [...members].sort((a, b) => {
      if (a.memberType !== b.memberType) return a.memberType === "AI" ? 1 : -1;
      return roleRank(a.role) - roleRank(b.role);
    });
  }, [members]);

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
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>멤버</h2>
        {canInvite ? (
          <button
            type="button"
            data-testid="project-member-invite-open"
            onClick={() => setInviteOpen(true)}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid #0d9488",
              background: "#0f766e",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            멤버 초대
          </button>
        ) : null}
      </div>
      <p style={{ margin: "0 0 14px 0", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
        AI 기획자는 프로젝트 생성 시 자동으로 포함됩니다. 사람 멤버는 아래에서 초대하고, 역할은 멤버 목록에서 확인할 수 있습니다.
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
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>HUMAN</div>
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

      <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>프로젝트 멤버 목록</div>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        {sortedMembers.length === 0 ? (
          <div style={{ padding: 14, fontSize: 13, color: "#64748b" }}>멤버가 없습니다.</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {sortedMembers.map((m) => (
              <li
                key={m.memberId}
                data-testid={`project-member-row-${m.memberId}`}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "10px 12px",
                  borderBottom: "1px solid #f1f5f9",
                  fontSize: 13,
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{m.displayName}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{projectRoleLabelKr(m.role)}</div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: m.memberType === "AI" ? "#ede9fe" : "#e0f2fe",
                    color: m.memberType === "AI" ? "#5b21b6" : "#0369a1",
                  }}
                >
                  {m.memberType}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <RequirementsMemberInviteModal
        open={inviteOpen}
        projectId={projectId}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          onMembersChanged();
        }}
        existingHumanUserIds={existingHumanUserIds}
      />
    </section>
  );
}
