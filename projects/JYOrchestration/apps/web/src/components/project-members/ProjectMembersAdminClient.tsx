"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ProjectRole } from "@/lib/auth/roles";
import { WorkspaceAiMemberAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
import {
  isWorkspaceAiMemberEnabled,
  listPlatformAiMemberCatalog,
  primaryIntegrationCapabilityForCatalogMember,
  type WorkspaceAiMemberId,
} from "@/lib/ai-member/platformAiMembers";
import {
  engineChoicesForCapability,
  enginePreferenceLabel,
  type WorkspaceAiEnginePreferenceKey,
} from "@/lib/workspace-ai/workspaceAiEnginePreference";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { allCatalogMemberIds, WORKSPACE_SCREEN_KEYS, WORKSPACE_SCREEN_LABEL, type WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";
import { WorkspaceAiMemberDetailModal, WorkspaceAiPersonaPromptModal } from "@/components/project-members/WorkspaceAiMemberPersonaDialogs";
import { MEDIA_QUERY } from "@/components/ui/breakpoints";
import { useMediaQuery } from "@/components/ui/useMediaQuery";

type AiDraftMemberRow = {
  catalogKey: WorkspaceAiMemberId;
  enabled: boolean;
  screenKeys: WorkspaceScreenKey[];
  screenAutoRun: Partial<Record<WorkspaceScreenKey, boolean>>;
  enginePreference: string;
};

type ApiProjectMember = {
  memberId: string;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: string;
  memberType: string;
  isOwner: boolean;
};

export type BannerTone = "success" | "info" | "neutral";

function adminBannerBoxStyle(tone: BannerTone): { background: string; border: string; color: string } {
  if (tone === "success") {
    return { background: "#f0fdf4", border: "1px solid #86efac", color: "#14532d" };
  }
  if (tone === "info") {
    return { background: "#eff6ff", border: "1px solid #93c5fd", color: "#1e3a8a" };
  }
  return { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#334155" };
}

/** 이메일 초대 시 UI에서 역할을 고르지 않음 — 수락 시 부여되는 기본 역할 */
const DEFAULT_EMAIL_INVITE_ROLE: ProjectRole = "EDITOR";

export function ProjectMembersAdminClient({ initialProjectId }: { readonly initialProjectId: string }) {
  const router = useRouter();
  /** 테이블 대신 카드·세로 스택 (워크플로 내비와 동일 ~720px) */
  const isNarrow = useMediaQuery(MEDIA_QUERY.workflowNavNarrow);
  const projectId = initialProjectId.trim();
  const [tab, setTab] = useState<"people" | "ai">("people");
  const [members, setMembers] = useState<ApiProjectMember[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: BannerTone } | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<AiDraftMemberRow[] | null>(null);
  const [aiGraphLoadState, setAiGraphLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [aiGraphError, setAiGraphError] = useState<string | null>(null);
  const [aiSaveBusy, setAiSaveBusy] = useState(false);
  const [aiDetailMemberId, setAiDetailMemberId] = useState<WorkspaceAiMemberId | null>(null);
  const [aiPromptMemberId, setAiPromptMemberId] = useState<WorkspaceAiMemberId | null>(null);

  /** SSR/CSR 동일 문자열 — 전체 URL은 복사 시에만 붙여 하이드레이션 불일치를 막습니다. */
  const joinPath = useMemo(() => {
    if (!projectId) return "";
    return `/requirements?projectId=${encodeURIComponent(projectId)}`;
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
      const json = (await res.json()) as {
        success?: boolean;
        data?: {
          members?: WorkspaceAiGraphMemberWire[];
        };
        message?: string;
      };
      if (!res.ok || !json.success || !json.data?.members) {
        setAiGraphLoadState("error");
        setAiGraphError(json.message || "AI 설정을 불러오지 못했습니다.");
        setAiDraft(null);
        return;
      }
      setAiDraft(
        json.data.members.map((m) => {
          const screenAutoRun: Partial<Record<WorkspaceScreenKey, boolean>> = {};
          for (const s of m.screens ?? []) {
            screenAutoRun[s.screenKey] = s.autoRun;
          }
          return {
            catalogKey: m.catalogKey,
            enabled: m.enabled,
            screenKeys: [...m.screenKeys],
            screenAutoRun,
            enginePreference: m.enginePreference ?? "USER_DEFAULT",
          };
        })
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

  const setEnginePreference = useCallback((catalogKey: WorkspaceAiMemberId, enginePreference: string) => {
    setAiDraft((prev) => (prev ? prev.map((r) => (r.catalogKey === catalogKey ? { ...r, enginePreference } : r)) : prev));
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
                  screenAutoRun: checked
                    ? r.screenAutoRun
                    : Object.fromEntries(
                        Object.entries(r.screenAutoRun).filter(([k]) => k !== screenKey)
                      ) as Partial<Record<WorkspaceScreenKey, boolean>>,
                }
              : r
          )
        : prev
    );
  }, []);

  const toggleScreenAutoRun = useCallback((catalogKey: WorkspaceAiMemberId, screenKey: WorkspaceScreenKey, autoRun: boolean) => {
    setAiDraft((prev) =>
      prev
        ? prev.map((r) => {
            if (r.catalogKey !== catalogKey) return r;
            const screenKeys =
              autoRun && !r.screenKeys.includes(screenKey) ? [...r.screenKeys, screenKey] : r.screenKeys;
            return {
              ...r,
              screenKeys,
              screenAutoRun: { ...r.screenAutoRun, [screenKey]: autoRun },
            };
          })
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
        const screenKeys = row?.screenKeys ?? [];
        const screens = screenKeys.map((sk) => ({
          screenKey: sk,
          autoRun: Boolean(row?.screenAutoRun[sk]),
        }));
        return {
          catalogKey,
          enabled: row?.enabled ?? true,
          screens,
          enginePreference: row?.enginePreference ?? "USER_DEFAULT",
        };
      });
      const res = await credentialsIncludeFetch("/api/project/workspace-ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, members }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setBanner({ text: json.message || "AI 설정 저장에 실패했습니다.", tone: "neutral" });
        return;
      }
      setBanner({ text: "AI 멤버·화면 참여 설정을 저장했습니다.", tone: "success" });
      await loadWorkspaceAiGraph();
    } catch {
      setBanner({ text: "AI 설정 저장 중 오류가 발생했습니다.", tone: "neutral" });
    } finally {
      setAiSaveBusy(false);
    }
  }, [projectId, aiDraft, canAdminWorkspaceAi, loadWorkspaceAiGraph]);

  const copyJoinLink = useCallback(async () => {
    if (!joinPath) return;
    try {
      const absolute =
        typeof window !== "undefined" ? `${window.location.origin}${joinPath}` : joinPath;
      await navigator.clipboard.writeText(absolute);
      setBanner({ text: "프로젝트 입장 링크를 클립보드에 복사했습니다.", tone: "success" });
    } catch {
      setBanner({ text: "클립보드 복사에 실패했습니다. 링크를 직접 선택해 복사해 주세요.", tone: "neutral" });
    }
  }, [joinPath]);

  const onInvite = useCallback(async () => {
    if (!projectId) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setBanner({ text: "초대할 이메일을 입력해 주세요.", tone: "neutral" });
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
          role: DEFAULT_EMAIL_INVITE_ROLE,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        outcome?: "USER_NOT_FOUND" | "ALREADY_MEMBER" | "INVITE_SENT";
      };
      if (!res.ok || !json.success) {
        setBanner({ text: json.message || "초대에 실패했습니다.", tone: "neutral" });
        return;
      }
      if (json.outcome === "USER_NOT_FOUND") {
        setBanner({
          text: json.message ?? "가입하지 않은 사용자입니다. 초대 링크를 전달해 주세요.",
          tone: "info",
        });
        return;
      }
      if (json.outcome === "ALREADY_MEMBER") {
        setBanner({ text: json.message ?? "이미 이 프로젝트의 멤버입니다.", tone: "info" });
        return;
      }
      if (json.outcome === "INVITE_SENT") {
        setInviteEmail("");
        setBanner({ text: json.message ?? "프로젝트 초대가 전송되었습니다.", tone: "success" });
        return;
      }
      setInviteEmail("");
      setBanner({ text: json.message || "처리되었습니다.", tone: "success" });
    } catch {
      setBanner({ text: "초대 요청 중 오류가 발생했습니다.", tone: "neutral" });
    } finally {
      setInviteBusy(false);
    }
  }, [projectId, inviteEmail]);

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
          setBanner({ text: json.message || "제거에 실패했습니다.", tone: "neutral" });
          return;
        }
        setBanner({ text: "멤버를 제거했습니다.", tone: "success" });
        await reloadMembers();
      } catch {
        setBanner({ text: "제거 중 오류가 발생했습니다.", tone: "neutral" });
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

  const tap = { minHeight: 44 } as const;

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: isNarrow ? "12px 12px max(32px, env(safe-area-inset-bottom))" : "20px 16px 48px",
      }}
    >
      <div
        style={{
          marginBottom: isNarrow ? 16 : 20,
          display: "flex",
          flexDirection: isNarrow ? "column" : "row",
          flexWrap: "wrap",
          alignItems: isNarrow ? "stretch" : "center",
          gap: isNarrow ? 10 : 12,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: isNarrow ? 18 : 22,
            fontWeight: 900,
            color: "#0f172a",
            lineHeight: 1.25,
          }}
        >
          프로젝트 멤버 관리
        </h1>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            marginLeft: isNarrow ? 0 : "auto",
            alignSelf: isNarrow ? "stretch" : undefined,
            fontSize: 14,
            fontWeight: 800,
            color: "#2563eb",
            background: isNarrow ? "#eff6ff" : "none",
            border: isNarrow ? "1px solid #bfdbfe" : "none",
            borderRadius: isNarrow ? 10 : 0,
            cursor: "pointer",
            padding: isNarrow ? "12px 14px" : "4px 0",
            textDecoration: isNarrow ? "none" : "underline",
            ...tap,
          }}
        >
          ← 이전 화면
        </button>
      </div>

      {banner ? (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: isNarrow ? "12px 14px" : "10px 12px",
            borderRadius: 10,
            fontSize: isNarrow ? 14 : 13,
            fontWeight: 700,
            lineHeight: 1.45,
            ...adminBannerBoxStyle(banner.tone),
          }}
        >
          {banner.text}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setTab("people")}
          style={{
            flex: isNarrow ? 1 : undefined,
            padding: isNarrow ? "12px 10px" : "8px 14px",
            borderRadius: 10,
            border: tab === "people" ? "2px solid #0d9488" : "1px solid #e2e8f0",
            background: tab === "people" ? "#ecfdf5" : "#fff",
            fontWeight: 800,
            fontSize: isNarrow ? 14 : 13,
            cursor: "pointer",
            color: "#0f172a",
            ...tap,
          }}
        >
          사람 멤버
        </button>
        <button
          type="button"
          onClick={() => setTab("ai")}
          style={{
            flex: isNarrow ? 1 : undefined,
            padding: isNarrow ? "12px 10px" : "8px 14px",
            borderRadius: 10,
            border: tab === "ai" ? "2px solid #0d9488" : "1px solid #e2e8f0",
            background: tab === "ai" ? "#ecfdf5" : "#fff",
            fontWeight: 800,
            fontSize: isNarrow ? 14 : 13,
            cursor: "pointer",
            color: "#0f172a",
            ...tap,
          }}
        >
          AI 멤버
        </button>
      </div>

      {tab === "people" ? (
        <div>
          <h2
            style={{
              fontSize: isNarrow ? 15 : 16,
              fontWeight: 900,
              color: "#0f172a",
              margin: "0 0 12px",
            }}
          >
            현재 멤버
          </h2>
          {loadState === "loading" ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>불러오는 중…</p>
          ) : loadError ? (
            <p style={{ color: "#b91c1c", fontSize: 14 }}>{loadError}</p>
          ) : isNarrow ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {humanMembers.map((m) => {
                const name = (m.displayName || m.email || "멤버").trim();
                const ownerRow = Boolean(m.isOwner);
                return (
                  <div
                    key={m.memberId}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      background: "#fff",
                      padding: "14px 14px",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 15, marginBottom: 6 }}>
                      {name}
                      {!m.userId ? (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "#ea580c", fontWeight: 800 }}>초대됨</span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#475569",
                        wordBreak: "break-word",
                        lineHeight: 1.4,
                        marginBottom: ownerRow ? 0 : 12,
                      }}
                    >
                      {m.email ?? "—"}
                    </div>
                    {!ownerRow ? (
                      <button
                        type="button"
                        disabled={removeBusyId === m.memberId}
                        onClick={() => void removeMember(m.memberId, name)}
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          color: "#b91c1c",
                          fontWeight: 800,
                          fontSize: 14,
                          cursor: removeBusyId === m.memberId ? "wait" : "pointer",
                          ...tap,
                        }}
                      >
                        제거
                      </button>
                    ) : null}
                  </div>
                );
              })}
              {!humanMembers.length ? (
                <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>등록된 사람 멤버가 없습니다.</div>
              ) : null}
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>이름</th>
                    <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>이메일</th>
                    <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {humanMembers.map((m) => {
                    const name = (m.displayName || m.email || "멤버").trim();
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
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          {ownerRow ? null : (
                            <button
                              type="button"
                              disabled={removeBusyId === m.memberId}
                              onClick={() => void removeMember(m.memberId, name)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: "1px solid #fecaca",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: removeBusyId === m.memberId ? "wait" : "pointer",
                              }}
                            >
                              제거
                            </button>
                          )}
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

          <h2
            style={{
              fontSize: isNarrow ? 15 : 16,
              fontWeight: 900,
              color: "#0f172a",
              margin: "28px 0 12px",
            }}
          >
            초대
          </h2>
          <p
            style={{
              fontSize: isNarrow ? 14 : 13,
              color: "#64748b",
              margin: "0 0 12px",
              lineHeight: 1.55,
            }}
          >
            플랫폼에 가입된 사용자에게는 로그인 후 알림으로 초대가 전달됩니다. 아직 가입하지 않은 사람에게는 아래 초대 링크를 복사해 전달해 주세요.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: isNarrow ? "column" : "row",
              flexWrap: isNarrow ? "nowrap" : "wrap",
              gap: isNarrow ? 10 : 10,
              alignItems: isNarrow ? "stretch" : "center",
              marginBottom: 12,
            }}
          >
            <input
              type="email"
              placeholder="이메일"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              style={{
                flex: isNarrow ? undefined : "1 1 200px",
                width: isNarrow ? "100%" : undefined,
                minWidth: isNarrow ? 0 : 180,
                padding: isNarrow ? "12px 14px" : "8px 10px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                fontSize: 16,
                ...tap,
              }}
            />
            <button
              type="button"
              disabled={inviteBusy}
              onClick={() => void onInvite()}
              style={{
                padding: isNarrow ? "12px 16px" : "8px 14px",
                borderRadius: 10,
                border: "none",
                background: "#0d9488",
                color: "#fff",
                fontWeight: 900,
                fontSize: isNarrow ? 15 : 13,
                cursor: inviteBusy ? "wait" : "pointer",
                width: isNarrow ? "100%" : undefined,
                ...tap,
              }}
            >
              초대 보내기
            </button>
            <button
              type="button"
              onClick={() => void copyJoinLink()}
              style={{
                padding: isNarrow ? "12px 16px" : "8px 14px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontWeight: 800,
                fontSize: isNarrow ? 15 : 13,
                cursor: "pointer",
                width: isNarrow ? "100%" : undefined,
                ...tap,
              }}
            >
              초대 링크 복사
            </button>
          </div>
          {joinPath ? (
            <code
              style={{
                display: "block",
                fontSize: isNarrow ? 11 : 12,
                padding: isNarrow ? "10px 12px" : "8px 10px",
                background: "#f8fafc",
                borderRadius: 8,
                wordBreak: "break-all",
                overflowWrap: "anywhere",
                color: "#334155",
                lineHeight: 1.45,
              }}
            >
              {joinPath}
            </code>
          ) : null}
        </div>
      ) : (
        <div>
          {!canAdminWorkspaceAi ? (
            <p style={{ fontSize: isNarrow ? 14 : 13, color: "#92400e", margin: "0 0 12px", fontWeight: 700, lineHeight: 1.5 }}>
              AI 설정 저장은 프로젝트 소유자만 할 수 있습니다. 조회는 멤버 누구나 가능합니다.
            </p>
          ) : null}
          <div
            style={{
              display: "flex",
              flexDirection: isNarrow ? "column" : "row",
              flexWrap: isNarrow ? "nowrap" : "wrap",
              gap: 10,
              alignItems: isNarrow ? "stretch" : "center",
              marginBottom: 14,
            }}
          >
            <button
              type="button"
              disabled={aiGraphLoadState === "loading" || aiSaveBusy}
              onClick={() => void loadWorkspaceAiGraph()}
              style={{
                padding: isNarrow ? "12px 16px" : "8px 14px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontWeight: 800,
                fontSize: isNarrow ? 15 : 13,
                cursor: aiGraphLoadState === "loading" ? "wait" : "pointer",
                width: isNarrow ? "100%" : undefined,
                ...tap,
              }}
            >
              새로고침
            </button>
            <button
              type="button"
              disabled={!canAdminWorkspaceAi || !aiDraft || aiSaveBusy || aiGraphLoadState === "loading"}
              onClick={() => void saveWorkspaceAiGraph()}
              style={{
                padding: isNarrow ? "12px 16px" : "8px 14px",
                borderRadius: 10,
                border: "none",
                background: !canAdminWorkspaceAi || !aiDraft ? "#e2e8f0" : "#0d9488",
                color: !canAdminWorkspaceAi || !aiDraft ? "#94a3b8" : "#fff",
                fontWeight: 900,
                fontSize: isNarrow ? 15 : 13,
                cursor: !canAdminWorkspaceAi || !aiDraft ? "not-allowed" : "pointer",
                width: isNarrow ? "100%" : undefined,
                ...tap,
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
              <h2 style={{ fontSize: isNarrow ? 15 : 16, fontWeight: 900, color: "#0f172a", margin: "0 0 10px" }}>AI 멤버</h2>
              {isNarrow ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
                  {listPlatformAiMemberCatalog().map((row) => {
                    const draftRow = aiDraft.find((r) => r.catalogKey === row.id);
                    const cap = primaryIntegrationCapabilityForCatalogMember(row.id);
                    const engineOpts = engineChoicesForCapability(cap);
                    const engineKey = (draftRow?.enginePreference ?? "USER_DEFAULT") as WorkspaceAiEnginePreferenceKey;
                    const buildOn = isWorkspaceAiMemberEnabled(row.id);
                    const projOn = Boolean(draftRow?.enabled);
                    return (
                      <div
                        key={row.id}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          background: "#fff",
                          padding: "14px 14px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                          <WorkspaceAiMemberAvatar memberId={row.id} size={44} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{row.title}</div>
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>엔진</div>
                          {canAdminWorkspaceAi ? (
                            <select
                              value={engineKey}
                              onChange={(e) => setEnginePreference(row.id, e.target.value)}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid #cbd5e1",
                                fontSize: 15,
                                fontWeight: 600,
                                background: "#fff",
                                ...tap,
                              }}
                            >
                              {engineOpts.map((ek) => (
                                <option key={ek} value={ek}>
                                  {enginePreferenceLabel(ek)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.45 }}>{enginePreferenceLabel(engineKey)}</div>
                          )}
                        </div>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: canAdminWorkspaceAi ? "pointer" : "not-allowed",
                            opacity: canAdminWorkspaceAi ? 1 : 0.75,
                            marginBottom: 8,
                            minHeight: 44,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={projOn}
                            disabled={!canAdminWorkspaceAi}
                            onChange={(e) => setCatalogEnabled(row.id, e.target.checked)}
                            style={{ width: 22, height: 22, accentColor: "#0d9488", flexShrink: 0 }}
                          />
                          <span style={{ fontWeight: 700, fontSize: 14, color: projOn ? "#0f766e" : "#94a3b8" }}>
                            프로젝트 활성: {projOn ? "켜짐" : "꺼짐"}
                          </span>
                        </label>
                        <div style={{ fontSize: 13, fontWeight: 700, color: buildOn ? "#0f766e" : "#94a3b8", marginBottom: 12 }}>
                          빌드: {buildOn ? "표시" : "숨김"}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAiDetailMemberId(row.id)}
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: 10,
                            border: "1px solid #0d9488",
                            background: "#fff",
                            color: "#0f766e",
                            fontWeight: 800,
                            fontSize: 14,
                            cursor: "pointer",
                            ...tap,
                          }}
                        >
                          상세보기
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", marginBottom: 22 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                        <th style={{ padding: "10px 8px", fontWeight: 800, color: "#64748b", width: 56, fontSize: 11 }}>아바타</th>
                        <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>이름</th>
                        <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>엔진</th>
                        <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>프로젝트 활성</th>
                        <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b" }}>빌드</th>
                        <th style={{ padding: "10px 12px", fontWeight: 800, color: "#64748b", whiteSpace: "nowrap" }}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listPlatformAiMemberCatalog().map((row) => {
                        const draftRow = aiDraft.find((r) => r.catalogKey === row.id);
                        const cap = primaryIntegrationCapabilityForCatalogMember(row.id);
                        const engineOpts = engineChoicesForCapability(cap);
                        const engineKey = (draftRow?.enginePreference ?? "USER_DEFAULT") as WorkspaceAiEnginePreferenceKey;
                        const buildOn = isWorkspaceAiMemberEnabled(row.id);
                        const projOn = Boolean(draftRow?.enabled);
                        return (
                          <tr key={row.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 8px", verticalAlign: "middle" }}>
                              <WorkspaceAiMemberAvatar memberId={row.id} size={36} />
                            </td>
                            <td style={{ padding: "10px 12px", fontWeight: 800 }}>{row.title}</td>
                            <td style={{ padding: "10px 12px", color: "#475569", minWidth: 200, verticalAlign: "middle" }}>
                              {canAdminWorkspaceAi ? (
                                <select
                                  value={engineKey}
                                  onChange={(e) => setEnginePreference(row.id, e.target.value)}
                                  style={{
                                    maxWidth: 300,
                                    width: "100%",
                                    padding: "6px 8px",
                                    borderRadius: 8,
                                    border: "1px solid #cbd5e1",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    background: "#fff",
                                  }}
                                >
                                  {engineOpts.map((ek) => (
                                    <option key={ek} value={ek}>
                                      {enginePreferenceLabel(ek)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ fontWeight: 600 }}>{enginePreferenceLabel(engineKey)}</span>
                              )}
                            </td>
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
              )}

              <h2 style={{ fontSize: isNarrow ? 15 : 16, fontWeight: 900, color: "#0f172a", margin: "0 0 10px" }}>화면별 참여 AI</h2>
              {isNarrow ? (
                <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px", lineHeight: 1.5 }}>
                  <span style={{ color: "#0f766e", fontWeight: 700 }}>표가 넓으면 좌우로 스크롤</span>해 주세요.
                </p>
              ) : null}
              <div
                style={{
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                  touchAction: "pan-x",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: "#fff",
                  marginBottom: isNarrow ? 8 : 0,
                }}
              >
                <table style={{ borderCollapse: "collapse", fontSize: isNarrow ? 13 : 12, minWidth: 720 }}>
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
                          const autoOn = Boolean(draftRow?.screenAutoRun[screenKey]);
                          const disabled = !canAdminWorkspaceAi || !isWorkspaceAiMemberEnabled(row.id);
                          const cb = isNarrow ? 20 : 16;
                          const labelStyle: CSSProperties = {
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            cursor: disabled ? "not-allowed" : "pointer",
                            fontSize: isNarrow ? 12 : 11,
                            fontWeight: 600,
                            color: "#334155",
                            userSelect: "none",
                          };
                          return (
                            <td key={row.id} style={{ padding: isNarrow ? "6px 4px" : "6px 4px", textAlign: "center", verticalAlign: "middle" }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                <label title="이 AI가 해당 단계에서 자동으로 참여합니다." style={labelStyle}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={(e) => toggleCatalogOnScreen(row.id, screenKey, e.target.checked)}
                                    style={{
                                      width: cb,
                                      height: cb,
                                      accentColor: "#0d9488",
                                      cursor: disabled ? "not-allowed" : "pointer",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span>참여</span>
                                </label>
                                <label
                                  title="참여한 단계에서 오케스트레이션 자동 실행을 허용합니다."
                                  style={{
                                    ...labelStyle,
                                    opacity: disabled || !checked ? 0.45 : 1,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={autoOn}
                                    disabled={disabled || !checked}
                                    onChange={(e) => toggleScreenAutoRun(row.id, screenKey, e.target.checked)}
                                    style={{
                                      width: cb,
                                      height: cb,
                                      accentColor: "#0d9488",
                                      cursor: disabled || !checked ? "not-allowed" : "pointer",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span>자동 실행</span>
                                </label>
                              </div>
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
          onCopied={(msg) => setBanner({ text: msg, tone: "success" })}
        />
      ) : null}
    </div>
  );
}
