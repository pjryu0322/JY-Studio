"use client";

import { useMemo, useState } from "react";
import type { ProjectRole } from "@/lib/auth/roles";

export type ProjectMemberUiRow = {
  memberId: string;
  userId: string | null;
  displayName: string;
  role: ProjectRole;
  memberType: "HUMAN" | "AI";
  aiProvider: string | null;
  isOwner: boolean;
};

type ProjectMembersSectionProps = {
  projectId: string;
  members: ProjectMemberUiRow[];
  canManageMembers: boolean;
  onChanged: () => Promise<void>;
};

const ROLE_OPTIONS: ProjectRole[] = ["OWNER", "EDITOR", "REVIEWER", "VIEWER"];

export function ProjectMembersSection({
  projectId,
  members,
  canManageMembers,
  onChanged,
}: ProjectMembersSectionProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteType, setInviteType] = useState<"HUMAN" | "AI">("HUMAN");
  const [inviteRole, setInviteRole] = useState<ProjectRole>("VIEWER");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteAiProvider, setInviteAiProvider] = useState("");
  const [inviteAiAgentKey, setInviteAiAgentKey] = useState("");
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.isOwner && !b.isOwner) return -1;
        if (!a.isOwner && b.isOwner) return 1;
        if (a.memberType !== b.memberType) return a.memberType === "HUMAN" ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      }),
    [members]
  );

  async function handleInviteSubmit() {
    setError(null);
    setMessage(null);
    setInviteBusy(true);
    try {
      const payload =
        inviteType === "HUMAN"
          ? {
              projectId,
              memberType: inviteType,
              role: inviteRole,
              email: inviteEmail.trim(),
            }
          : {
              projectId,
              memberType: inviteType,
              role: inviteRole,
              displayName: inviteDisplayName.trim(),
              aiProvider: inviteAiProvider.trim() || null,
              aiAgentKey: inviteAiAgentKey.trim() || null,
            };
      const res = await fetch("/api/project/members/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "멤버 초대에 실패했습니다.");
      }
      setInviteEmail("");
      setInviteDisplayName("");
      setInviteAiProvider("");
      setInviteAiAgentKey("");
      setMessage(json.message || "멤버가 추가되었습니다.");
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "멤버 초대 중 오류가 발생했습니다.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRoleChange(memberId: string, role: ProjectRole) {
    setError(null);
    setMessage(null);
    setBusyMemberId(memberId);
    try {
      const res = await fetch(`/api/project/members/${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "역할 변경에 실패했습니다.");
      }
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "역할 변경 중 오류가 발생했습니다.");
    } finally {
      setBusyMemberId(null);
    }
  }

  async function handleRemove(memberId: string) {
    const ok = window.confirm("해당 멤버를 프로젝트에서 제거하시겠습니까?");
    if (!ok) return;
    setError(null);
    setMessage(null);
    setBusyMemberId(memberId);
    try {
      const res = await fetch(`/api/project/members/${encodeURIComponent(memberId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "멤버 제거에 실패했습니다.");
      }
      setMessage("멤버가 제거되었습니다.");
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "멤버 제거 중 오류가 발생했습니다.");
    } finally {
      setBusyMemberId(null);
    }
  }

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>멤버 관리</h2>
      <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
        HUMAN / AI 멤버를 프로젝트 단위로 관리합니다.
      </p>
      {canManageMembers ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => setInviteOpen((v) => !v)}>
            {inviteOpen ? "초대 패널 닫기" : "멤버 초대"}
          </button>
        </div>
      ) : null}
      {inviteOpen && canManageMembers ? (
        <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <select value={inviteType} onChange={(e) => setInviteType(e.target.value as "HUMAN" | "AI")}>
              <option value="HUMAN">HUMAN</option>
              <option value="AI">AI</option>
            </select>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as ProjectRole)}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {inviteType === "HUMAN" ? (
              <input
                placeholder="user email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            ) : (
              <>
                <input
                  placeholder="AI display name"
                  value={inviteDisplayName}
                  onChange={(e) => setInviteDisplayName(e.target.value)}
                />
                <input
                  placeholder="AI provider (optional)"
                  value={inviteAiProvider}
                  onChange={(e) => setInviteAiProvider(e.target.value)}
                />
                <input
                  placeholder="AI agent key (optional)"
                  value={inviteAiAgentKey}
                  onChange={(e) => setInviteAiAgentKey(e.target.value)}
                />
              </>
            )}
            <button type="button" disabled={inviteBusy} onClick={handleInviteSubmit}>
              {inviteBusy ? "처리 중..." : "추가"}
            </button>
          </div>
        </div>
      ) : null}
      {message ? <p style={{ color: "#0b6b0b", fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: "#b42318", fontSize: 13 }}>{error}</p> : null}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {sortedMembers.map((m) => (
          <li
            key={m.memberId}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              borderBottom: "1px solid #eee",
              paddingBottom: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{m.memberType === "AI" ? "🤖" : "👤"}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: m.memberType === "AI" ? "#ede9fe" : "#eef2ff",
                color: m.memberType === "AI" ? "#5b21b6" : "#1d4ed8",
              }}
            >
              {m.memberType}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid #d0d5dd",
                background: "#f8fafc",
              }}
            >
              {m.role}
            </span>
            <strong>{m.displayName}</strong>
            {m.aiProvider ? <span style={{ color: "#666", fontSize: 12 }}>({m.aiProvider})</span> : null}
            {canManageMembers ? (
              <>
                <select
                  disabled={busyMemberId === m.memberId || m.isOwner}
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.memberId, e.target.value as ProjectRole)}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busyMemberId === m.memberId || m.isOwner}
                  onClick={() => handleRemove(m.memberId)}
                >
                  제거
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
