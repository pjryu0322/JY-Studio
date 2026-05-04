"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectRole } from "@/lib/auth/roles";
import { WorkspaceAiMemberAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
import {
  getWorkspaceAiExecutionProviderLabel,
  isWorkspaceAiMemberEnabled,
  listPlatformAiMemberCatalog,
  type WorkspaceAiMemberId,
} from "@/lib/ai-member/platformAiMembers";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { allCatalogMemberIds, WORKSPACE_SCREEN_KEYS, WORKSPACE_SCREEN_LABEL, type WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";
import { WorkspaceAiMemberDetailModal, WorkspaceAiPersonaPromptModal } from "@/components/project-members/WorkspaceAiMemberPersonaDialogs";

type ApiProjectMember = {
  memberId: string;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: string;
  memberType: string;
  isOwner: boolean;
};

const HUMAN_ROLE_OPTIONS: readonly { readonly value: ProjectRole; readonly label: string }[] = [
  { value: "OWNER", label: "소유자" },
  { value: "EDITOR", label: "멤버(편집)" },
  { value: "REVIEWER", label: "전문가(검토)" },
  { value: "VIEWER", label: "보기 전용" },
];

function normalizeProjectRole(raw: string): ProjectRole | null {
  const r = String(raw ?? "").trim().toUpperCase();
  if (r === "OWNER" || r === "EDITOR" || r === "REVIEWER" || r === "VIEWER") return r;
  return null;
}

export function ProjectMembersAdminClient({ initialProjectId }: { readonly initialProjectId: string }) {
  const projectId = initialProjectId.trim();
  const [tab, setTab] = useState<"people" | "ai">("people");
  const [members, setMembers] = useState<ApiProjectMember[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ProjectRole>("EDITOR");
  const [inviteBusy, setInviteBusy] = useState(false);

  const [pendingRoleByMember, setPendingRoleByMember] = useState<Record<string, ProjectRole>>({});
  const [roleSaveBusyId, setRoleSaveBusyId] = useState<string | null>(null);
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<
    { readonly catalogKey: WorkspaceAiMemberId; readonly enabled: boolean; readonly screenKeys: WorkspaceScreenKey[] }[] | null
  >(null);
  const [aiGraphLoadState, setAiGraphLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [aiGraphError, setAiGraphError] = useState<string | null>(null);
  const [aiSaveBusy, setAiSaveBusy] = useState(false);
  const [aiDetailMemberId, setAiDetailMemberId] = useState<WorkspaceAiMemberId | null>(null);
  const [aiPromptMemberId, setAiPromptMemberId] = useState<WorkspaceAiMemberId | null>(null);

  const joinLink = useMemo(() => {
    if (!projectId || typeof window === "undefined") return "";
    return `${window.location.origin}/requirements?projectId=${encodeURIComponent(projectId)}`;
  }, [projectId]);

  const reloadMembers = useCallback(async () => {
    if (!projectId) {
      setMembers([]);
      setLoadState("idle");
      return;
    }
    setLoadState("loading");
    setLoadError(null);
    try {
      const res = await credentialsIncludeFetch(`/api/project/members?projectId=${encodeURIComponent(projectId)}`);
      const json = (await res.json()) as { success?: boolean; data?: ApiProjectMember[]; message?: string };
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setLoadState("error");
        setLoadError(json.message || "멤버를 불러오지 못했습니다.");
        setMembers([]);
        return;
      }
      setMembers(json.data);
      setPendingRoleByMember((prev) => {
        const next = { ...prev };
        for (const m of json.data!) {
          const r = normalizeProjectRole(m.role);
          if (r) next[m.memberId] = r;
        }
        return next;
      });
      setLoadState("idle");
    } catch {
      setLoadState("error");
      setLoadError("네트워크 오류로 멤버를 불러오지 못했습니다.");
      setMembers([]);
    }
  }, [projectId]);

  useEffect(() => {
    void reloadMembers();
  }, [reloadMembers]);

  const humanMembers = useMemo(() => members.filter((m) => m.memberType === "HUMAN"), [members]);

  const canAdminWorkspaceAi = useMemo(() => {
    return humanMembers.some((m) => m.isOwner && m.userId && m.userId === sessionUserId);
  }, [humanMembers, sessionUserId]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await credentialsIncludeFetch("/api/auth/me");
        const json = (await res.json()) as { success?: boolean; data?: { id?: string } | null };
        if (res.ok && json.success && json.data?.id) setSessionUserId(String(json.data.id));
        else setSessionUserId(null);
      } catch {
        setSessionUserId(null);
      }
    })();
  }, []);

  const loadWorkspaceAiGraph = useCallback(async () => {
    if (!projectId) {
      setAiDraft(null);
      return;
    }
    setAiGraphLoadState("loading");
    setAiGraphError(null);
    try {
      const res = await credentialsIncludeFetch(`/api/project/workspace-ai?projectId=${encodeURIComponent(projectId)}`);
      const json = (await res.json()) as { success?: boolean; data?: { members?: WorkspaceAiGraphMemberWire[] }; message?: string };
      if (!res.ok || !json.success || !json.data?.members) {
        setAiGraphLoadState("error");
        setAiGraphError(json.message || "AI 설정을 불러오지 못했습니다.");
        setAiDraft(null);
        return;
      }
      setAiDraft(
        json.data.members.map((m) => ({
          catalogKey: m.catalogKey,
          enabled: m.enabled,
          screenKeys: [...m.screenKeys],
        }))
      );
      setAiGraphLoadState("idle");
    } catch {
      setAiGraphLoadState("error");
      setAiGraphError("네트워크 오류로 AI 설정을 불러오지 못했습니다.");
      setAiDraft(null);
    }
  }, [projectId]);

  useEffect(() => {
    if (tab !== "ai") return;
    void loadWorkspaceAiGraph();
  }, [tab, loadWorkspaceAiGraph]);

  const setCatalogEnabled = useCallback((catalogKey: WorkspaceAiMemberId, enabled: boolean) => {
    setAiDraft((prev) =>
      prev ? prev.map((r) => (r.catalogKey === catalogKey ? { ...r, enabled } : r)) : prev
    );
  }, []);

  const toggleCatalogOnScreen = useCallback((catalogKey: WorkspaceAiMemberId, screenKey: WorkspaceScreenKey, checked: boolean) => {
    setAiDraft((prev) =>
      prev
        ? prev.map((r) =>
            r.catalogKey === catalogKey
              ? {
                  ...r,
                  screenKeys: checked
                    ? r.screenKeys.includes(screenKey)
                      ? r.screenKeys
                      : [...r.screenKeys, screenKey]
                    : r.screenKeys.filter((s) => s !== screenKey),
                }
              : r
          )
        : prev
    );
  }, []);

  const saveWorkspaceAiGraph = useCallback(async () => {
    if (!projectId || !aiDraft || !canAdminWorkspaceAi) return;
    setAiSaveBusy(true);
    setBanner(null);
    try {
      const members = allCatalogMemberIds().map((catalogKey) => {
        const row = aiDraft.find((r) => r.catalogKey === catalogKey);
        return {
          catalogKey,
          enabled: row?.enabled ?? true,
          screenKeys: row?.screenKeys ?? [],
        };
      });
      const res = await credentialsIncludeFetch("/api/project/workspace-ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, members }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setBanner(json.message || "AI 설정 저장에 실패했습니다.");
        return;
      }
      setBanner("AI 멤버·화면 참여 설정을 저장했습니다.");
      await loadWorkspaceAiGraph();
    } catch {
      setBanner("AI 설정 저장 중 오류가 발생했습니다.");
    } finally {
      setAiSaveBusy(false);
    }
  }, [projectId, aiDraft, canAdminWorkspaceAi, loadWorkspaceAiGraph]);

  const copyJoinLink = useCallback(async () => {
    if (!joinLink) return;
    try {
      await navigator.clipboard.writeText(joinLink);
      setBanner("프로젝트 입장 링크를 클립보드에 복사했습니다.");
    } catch {
      setBanner("클립보드 복사에 실패했습니다. 링크를 직접 선택해 복사해 주세요.");
    }
  }, [joinLink]);

  const onInvite = useCallback(async () => {
    if (!projectId) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setBanner("초대할 이메일을 입력해 주세요.");
      return;
    }
    setInviteBusy(true);
    setBanner(null);
    try {
      const res = await credentialsIncludeFetch("/api/project/members/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          memberType: "HUMAN",
          email,
          role: inviteRole,
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setBanner(json.message || "초대에 실패했습니다.");
        return;
      }
      setInviteEmail("");
      setBanner("멤버를 초대했습니다.");
      await reloadMembers();
    } catch {
      setBanner("초대 요청 중 오류가 발생했습니다.");
    } finally {
      setInviteBusy(false);
    }
  }, [projectId, inviteEmail, inviteRole, reloadMembers]);

  const saveRole = useCallback(
    async (memberId: string) => {
      const role = pendingRoleByMember[memberId];
      if (!role) return;
      setRoleSaveBusyId(memberId);
      setBanner(null);
      try {
        const res = await credentialsIncludeFetch(`/api/project/members/${encodeURIComponent(memberId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          setBanner(json.message || "역할 변경에 실패했습니다.");
          return;
        }
        setBanner("역할을 저장했습니다.");
        await reloadMembers();
      } catch {
        setBanner("역할 저장 중 오류가 발생했습니다.");
      } finally {
        setRoleSaveBusyId(null);
      }
    },
    [pendingRoleByMember, reloadMembers]
  );

  const removeMember = useCallback(
    async (memberId: string, label: string) => {
      if (!window.confirm(`${label} 멤버를 프로젝트에서 제거할까요?`)) return;
      setRemoveBusyId(memberId);
      setBanner(null);
      try {
        const res = await credentialsIncludeFetch(`/api/project/members/${encodeURIComponent(memberId)}`, {
          method: "DELETE",
        });
        const json = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !json.success) {
          setBanner(json.message || "제거에 실패했습니다.");
          return;
        }
        setBanner("멤버를 제거했습니다.");
        await reloadMembers();
      } catch {
        setBanner("제거 중 오류가 발생했습니다.");
      } finally {
        setRemoveBusyId(null);
      }
    },
    [reloadMembers]
  );

  const aiDetailCatalog = aiDetailMemberId
    ? listPlatformAiMemberCatalog().find((m) => m.id === aiDetailMemberId)
    : undefined;
  const aiPromptCatalog = aiPromptMemberId
    ? listPlatformAiMemberCatalog().find((m) => m.id === aiPromptMemberId)
    : undefined;
  const aiDetailDraftRow =
    aiDetailMemberId && aiDraft ? aiDraft.find((r) => r.catalogKey === aiDetailMemberId) : undefined;

  if (!projectId) {
    return (
      <div style={{ maxWidth: 720, margin: "48px auto", padding: "0 16px", fontSize: 15, color: "#475569" }}>
        <p style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>프로젝트가 지정되지 않았습니다.</p>
        <p style={{ marginBottom: 16 }}>
          URL에 <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>?projectId=…</code> 가 필요합니다.
        </p>
        <Link href="/" style={{ color: "#2563eb", fontWeight: 800 }}>
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 48px" }}>
      <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>프로젝트 멤버 관리</h1>
        <span style={{ fontSize: 13, color: "#64748b" }}>프로젝트 ID · {projectId}</span>
        <Link
          href={`/requirements?projectId=${encodeURIComponent(projectId)}`}
          style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}
        >
          요구사항으로 돌아가기
        </Link>
      </div>

      {banner ? (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 10,
            background: "#f0fdf4",
            border: "1px solid #86efac",
            color: "#14532d",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {banner}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setTab("people")}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: tab === "people" ? "2px solid #0d9488" : "1px solid #e2e8f0",
            background: tab === "people" ? "#ecfdf5" : "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            color: "#0f172a",
          }}
        >
          사람 멤버
        </button>
        <button
          type="button"
          onClick={() => setTab("ai")}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: tab === "ai" ? "2px solid #0d9488" : "1px solid #e2e8f0",
            background: tab === "ai" ? "#ecfdf5" : "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            color: "#0f172a",
          }}
        >
          AI 멤버
        </button>
      </div>

      {tab === "people" ? (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: "0 0 12px" }}>현재 멤버</h2>
          {loadState === "loading" ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>불러오는 중…</p>
          ) : loadError ? (
            <p style={{ color: "#b91c1c", fontSize: 14 }}>{loadError}</p>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>이름</th>
                    <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>이메일</th>
                    <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>역할</th>
                    <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {humanMembers.map((m) => {
                    const name = (m.displayName || m.email || "멤버").trim();
                    const current = normalizeProjectRole(m.role) ?? "VIEWER";
                    const pending = pendingRoleByMember[m.memberId] ?? current;
                    const ownerRow = Boolean(m.isOwner);
                    return (
                      <tr key={m.memberId} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                          {name}
                          {!m.userId ? (
                            <span style={{ marginLeft: 8, fontSize: 11, color: "#ea580c", fontWeight: 800 }}>초대됨</span>
                          ) : null}
                        </td>
                        <td style={{ padding: "10px 12px", color: "#475569" }}>{m.email ?? "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <select
                            value={pending}
                            disabled={ownerRow}
                            onChange={(e) =>
                              setPendingRoleByMember((prev) => ({
                                ...prev,
                                [m.memberId]: e.target.value as ProjectRole,
                              }))
                            }
                            style={{
                              padding: "6px 8px",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              fontWeight: 600,
                              maxWidth: 180,
                            }}
                          >
                            {HUMAN_ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            disabled={ownerRow || pending === current || roleSaveBusyId === m.memberId}
                            onClick={() => void saveRole(m.memberId)}
                            style={{
                              padding: "6px 10px",
                              marginRight: 8,
                              borderRadius: 8,
                              border: "1px solid #0d9488",
                              background: ownerRow || pending === current ? "#f1f5f9" : "#0d9488",
                              color: ownerRow || pending === current ? "#94a3b8" : "#fff",
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: ownerRow || pending === current ? "not-allowed" : "pointer",
                            }}
                          >
                            역할 저장
                          </button>
                          <button
                            type="button"
                            disabled={ownerRow || removeBusyId === m.memberId}
                            onClick={() => void removeMember(m.memberId, name)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid #fecaca",
                              background: ownerRow ? "#f8fafc" : "#fef2f2",
                              color: ownerRow ? "#94a3b8" : "#b91c1c",
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: ownerRow ? "not-allowed" : "pointer",
                            }}
                          >
                            제거
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!humanMembers.length ? (
                <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>등록된 사람 멤버가 없습니다.</div>
              ) : null}
            </div>
          )}

          <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: "28px 0 12px" }}>초대</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>
            이메일로 멤버를 등록합니다. 초대받은 사용자는 계정으로 로그인한 뒤 아래 링크로 프로젝트에 진입할 수 있습니다.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
            <input
              type="email"
              placeholder="이메일"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{
                flex: "1 1 200px",
                minWidth: 180,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                fontSize: 14,
              }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", fontWeight: 700 }}
            >
              {HUMAN_ROLE_OPTIONS.filter((o) => o.value !== "OWNER").map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={inviteBusy}
              onClick={() => void onInvite()}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "none",
                background: "#0d9488",
                color: "#fff",
                fontWeight: 900,
                fontSize: 13,
                cursor: inviteBusy ? "wait" : "pointer",
              }}
            >
              초대 보내기
            </button>
            <button
              type="button"
              onClick={() => void copyJoinLink()}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              초대 링크 복사
            </button>
          </div>
          {joinLink ? (
            <code
              style={{
                display: "block",
                fontSize: 12,
                padding: "8px 10px",
                background: "#f8fafc",
                borderRadius: 8,
                wordBreak: "break-all",
                color: "#334155",
              }}
            >
              {joinLink}
            </code>
          ) : null}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.6 }}>
            프로젝트별로 각 AI가 참여할 화면을 여러 개 지정할 수 있습니다. 빌드 시{" "}
            <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 6 }}>NEXT_PUBLIC_AI_MEMBER_*</code> 로 꺼진
            페르소나는 워크스페이스에 표시되지 않습니다.
          </p>
          {!canAdminWorkspaceAi ? (
            <p style={{ fontSize: 13, color: "#92400e", margin: "0 0 12px", fontWeight: 700 }}>
              AI 설정 저장은 프로젝트 소유자만 할 수 있습니다. 조회는 멤버 누구나 가능합니다.
            </p>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <button
              type="button"
              disabled={aiGraphLoadState === "loading" || aiSaveBusy}
              onClick={() => void loadWorkspaceAiGraph()}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontWeight: 800,
                fontSize: 13,
                cursor: aiGraphLoadState === "loading" ? "wait" : "pointer",
              }}
            >
              새로고침
            </button>
            <button
              type="button"
              disabled={!canAdminWorkspaceAi || !aiDraft || aiSaveBusy || aiGraphLoadState === "loading"}
              onClick={() => void saveWorkspaceAiGraph()}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "none",
                background: !canAdminWorkspaceAi || !aiDraft ? "#e2e8f0" : "#0d9488",
                color: !canAdminWorkspaceAi || !aiDraft ? "#94a3b8" : "#fff",
                fontWeight: 900,
                fontSize: 13,
                cursor: !canAdminWorkspaceAi || !aiDraft ? "not-allowed" : "pointer",
              }}
            >
              {aiSaveBusy ? "저장 중…" : "설정 저장"}
            </button>
          </div>
          {aiGraphLoadState === "loading" ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>AI 설정을 불러오는 중…</p>
          ) : aiGraphError ? (
            <p style={{ color: "#b91c1c", fontSize: 14 }}>{aiGraphError}</p>
          ) : !aiDraft ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>AI 설정이 없습니다.</p>
          ) : (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: "0 0 10px" }}>AI 멤버</h2>
              <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", marginBottom: 22 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={{ padding: "10px 8px", fontWeight: 800, color: "#64748b", width: 56, fontSize: 11 }}>아바타</th>
                      <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>이름</th>
                      <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>참여 화면</th>
                      <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>엔진</th>
                      <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>프로젝트 활성</th>
                      <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>빌드</th>
                      <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b", whiteSpace: "nowrap" }}>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listPlatformAiMemberCatalog().map((row) => {
                      const draftRow = aiDraft.find((r) => r.catalogKey === row.id);
                      const screens = (draftRow?.screenKeys ?? []).map((k) => WORKSPACE_SCREEN_LABEL[k]).filter(Boolean);
                      const buildOn = isWorkspaceAiMemberEnabled(row.id);
                      const projOn = Boolean(draftRow?.enabled);
                      return (
                        <tr key={row.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 8px", verticalAlign: "middle" }}>
                            <WorkspaceAiMemberAvatar memberId={row.id} size={36} />
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 800 }}>{row.title}</td>
                          <td style={{ padding: "10px 12px", color: "#475569", lineHeight: 1.45 }}>
                            {screens.length ? screens.join(" · ") : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#475569" }}>{getWorkspaceAiExecutionProviderLabel(row.id)}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                cursor: canAdminWorkspaceAi ? "pointer" : "not-allowed",
                                opacity: canAdminWorkspaceAi ? 1 : 0.75,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={projOn}
                                disabled={!canAdminWorkspaceAi}
                                onChange={(e) => setCatalogEnabled(row.id, e.target.checked)}
                                style={{ width: 18, height: 18, accentColor: "#0d9488" }}
                              />
                              <span style={{ fontWeight: 700, color: projOn ? "#0f766e" : "#94a3b8" }}>{projOn ? "켜짐" : "꺼짐"}</span>
                            </label>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ fontWeight: 700, color: buildOn ? "#0f766e" : "#94a3b8" }}>{buildOn ? "표시" : "숨김"}</span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <button
                              type="button"
                              onClick={() => setAiDetailMemberId(row.id)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #0d9488",
                                background: "#fff",
                                color: "#0f766e",
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              상세보기
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <h2 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: "0 0 10px" }}>화면별 참여 AI</h2>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px", lineHeight: 1.5 }}>
                행은 화면, 열은 AI입니다. 체크하면 해당 화면 작업에 그 AI가 참여합니다.
              </p>
              <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: "8px 10px", fontWeight: 800, color: "#64748b", textAlign: "left", position: "sticky", left: 0, background: "#f8fafc", zIndex: 1 }}>
                        화면
                      </th>
                      {listPlatformAiMemberCatalog().map((row) => (
                        <th
                          key={row.id}
                          style={{
                            padding: "8px 6px",
                            fontWeight: 800,
                            color: "#64748b",
                            textAlign: "center",
                            minWidth: 72,
                            maxWidth: 96,
                            lineHeight: 1.25,
                          }}
                        >
                          {row.title.replace(/^AI\s*/, "")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {WORKSPACE_SCREEN_KEYS.map((screenKey) => (
                      <tr key={screenKey} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td
                          style={{
                            padding: "8px 10px",
                            fontWeight: 700,
                            color: "#334155",
                            whiteSpace: "nowrap",
                            position: "sticky",
                            left: 0,
                            background: "#fff",
                            zIndex: 1,
                          }}
                        >
                          {WORKSPACE_SCREEN_LABEL[screenKey]}
                        </td>
                        {listPlatformAiMemberCatalog().map((row) => {
                          const draftRow = aiDraft.find((r) => r.catalogKey === row.id);
                          const checked = Boolean(draftRow?.screenKeys.includes(screenKey));
                          const disabled = !canAdminWorkspaceAi || !isWorkspaceAiMemberEnabled(row.id);
                          return (
                            <td key={row.id} style={{ padding: "6px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={(e) => toggleCatalogOnScreen(row.id, screenKey, e.target.checked)}
                                style={{ width: 17, height: 17, accentColor: "#0d9488", cursor: disabled ? "not-allowed" : "pointer" }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {aiDetailCatalog ? (
        <WorkspaceAiMemberDetailModal
          open
          catalog={aiDetailCatalog}
          screenKeys={aiDetailDraftRow?.screenKeys ?? []}
          buildVisible={isWorkspaceAiMemberEnabled(aiDetailCatalog.id)}
          projectEnabled={Boolean(aiDetailDraftRow?.enabled)}
          onClose={() => {
            setAiDetailMemberId(null);
            setAiPromptMemberId(null);
          }}
          onOpenPrompt={() => setAiPromptMemberId(aiDetailCatalog.id)}
        />
      ) : null}

      {aiPromptCatalog ? (
        <WorkspaceAiPersonaPromptModal
          open
          memberId={aiPromptCatalog.id}
          memberTitle={aiPromptCatalog.title}
          readOnly
          onClose={() => setAiPromptMemberId(null)}
          onCopied={(msg) => setBanner(msg)}
        />
      ) : null}
    </div>
  );
}
