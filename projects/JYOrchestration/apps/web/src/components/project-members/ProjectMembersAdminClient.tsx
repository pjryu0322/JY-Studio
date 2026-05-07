"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ProjectRole } from "@/lib/auth/roles";
import { WorkspaceAiMemberAvatar } from "@/components/ai-member/WorkspaceAiMemberAvatar";
import {
  isWorkspaceAiMemberEnabled,
  listPlatformAiMemberCatalog,
  type WorkspaceAiMemberId,
} from "@/lib/ai-member/platformAiMembers";
import {
  PROJECT_AI_OPENAI_MODELS,
  deriveProjectAiAgentUiState,
  persistPrefsFromUi,
  projectAiAgentEngineChoices,
  projectAiAgentModelWhenEngineChanges,
  type ProjectAiAgentUiEngine,
  type ProjectAiAgentUiModel,
} from "@/lib/workspace-ai/projectAiAgentEngineModel";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import {
  allCatalogMemberIds,
  WORKSPACE_AI_AGENT_PROCEDURE_TABLE_ROWS,
  WORKSPACE_SCREEN_LABEL,
  type WorkspaceScreenKey,
} from "@/lib/workspace-ai/workspaceScreenKeys";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";
import { WorkspaceAiMemberDetailModal, WorkspaceAiPersonaPromptModal } from "@/components/project-members/WorkspaceAiMemberPersonaDialogs";
import { MEDIA_QUERY } from "@/components/ui/breakpoints";
import { useMediaQuery } from "@/components/ui/useMediaQuery";

type AiDraftMemberRow = {
  catalogKey: WorkspaceAiMemberId;
  enabled: boolean;
  screenKeys: WorkspaceScreenKey[];
  screenAutoRun: Partial<Record<WorkspaceScreenKey, boolean>>;
  uiEngine: ProjectAiAgentUiEngine;
  uiModel: ProjectAiAgentUiModel;
  /** 저장된 값이 비정상(Cursor on non-개발자)일 때 */
  cursorPolicyWarn: boolean;
};

function uiEngineLabel(e: ProjectAiAgentUiEngine): string {
  if (e === "USER_DEFAULT") return "User Default";
  if (e === "OPENAI") return "OpenAI";
  return "Cursor";
}

function uiModelLabel(m: ProjectAiAgentUiModel): string {
  if (m === "USER_DEFAULT") return "User Default";
  if (m === "cursor-default") return "cursor-default";
  return m;
}

function agentTitleForUi(rawTitle: string): string {
  const base = String(rawTitle || "").replace(/^AI\s*/i, "").trim();
  if (base === "기능설계자") return "설계자";
  return base;
}

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
  const [aiDirty, setAiDirty] = useState(false);
  const [aiAutoSaveTick, setAiAutoSaveTick] = useState(0);

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
  type MemberSortKey = "displayName" | "email" | "status";
  const [memberSortKey, setMemberSortKey] = useState<MemberSortKey>("displayName");
  const [memberSortDir, setMemberSortDir] = useState<"asc" | "desc">("asc");

  const sortedHumanMembers = useMemo(() => {
    const dir = memberSortDir === "asc" ? 1 : -1;
    const getName = (m: ApiProjectMember) => String(m.displayName || m.email || "멤버").trim().toLowerCase();
    const getEmail = (m: ApiProjectMember) => String(m.email || "").trim().toLowerCase();
    const getStatus = (m: ApiProjectMember) => (m.userId ? "가입됨" : "초대됨");
    const list = [...humanMembers];
    list.sort((a, b) => {
      if (memberSortKey === "displayName") return getName(a).localeCompare(getName(b)) * dir;
      if (memberSortKey === "email") return getEmail(a).localeCompare(getEmail(b)) * dir;
      return getStatus(a).localeCompare(getStatus(b)) * dir;
    });
    return list;
  }, [humanMembers, memberSortKey, memberSortDir]);

  const paddedHumanMembers = useMemo(() => {
    const minRows = 10;
    const base = sortedHumanMembers;
    if (base.length >= minRows) return base;
    const blanks = Array.from({ length: minRows - base.length }, () => null as ApiProjectMember | null);
    return [...base, ...blanks];
  }, [sortedHumanMembers]);

  const toggleMemberSort = useCallback((key: MemberSortKey) => {
    if (memberSortKey === key) {
      setMemberSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setMemberSortKey(key);
    setMemberSortDir("asc");
  }, [memberSortKey]);

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
          const st = deriveProjectAiAgentUiState({
            catalogKey: m.catalogKey,
            graphEnginePreference: m.enginePreference,
            memberAiProvider: m.aiProvider,
            memberAiModelOverride: m.aiModelOverride,
          });
          return {
            catalogKey: m.catalogKey,
            enabled: m.enabled,
            screenKeys: [...m.screenKeys],
            screenAutoRun,
            uiEngine: st.uiEngine,
            uiModel: st.uiModel,
            cursorPolicyWarn: st.invalidCursorOnNonDeveloper,
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
    setAiDirty(true);
    setAiDraft((prev) =>
      prev ? prev.map((r) => (r.catalogKey === catalogKey ? { ...r, enabled } : r)) : prev
    );
  }, []);

  const setUiEngine = useCallback((catalogKey: WorkspaceAiMemberId, uiEngine: ProjectAiAgentUiEngine) => {
    setAiDirty(true);
    setAiDraft((prev) =>
      prev
        ? prev.map((r) => {
            if (r.catalogKey !== catalogKey) return r;
            const uiModel = projectAiAgentModelWhenEngineChanges(catalogKey, uiEngine, r.uiModel);
            return { ...r, uiEngine, uiModel, cursorPolicyWarn: false };
          })
        : prev
    );
  }, []);

  const setUiModel = useCallback((catalogKey: WorkspaceAiMemberId, uiModel: ProjectAiAgentUiModel) => {
    setAiDirty(true);
    setAiDraft((prev) =>
      prev ? prev.map((r) => (r.catalogKey === catalogKey ? { ...r, uiModel, cursorPolicyWarn: false } : r)) : prev
    );
  }, []);

  const toggleCatalogOnScreen = useCallback((catalogKey: WorkspaceAiMemberId, screenKey: WorkspaceScreenKey, checked: boolean) => {
    setAiDirty(true);
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
                  // "참여"는 자동실행을 전제로 합니다.
                  screenAutoRun: checked
                    ? { ...r.screenAutoRun, [screenKey]: true }
                    : (Object.fromEntries(
                        Object.entries(r.screenAutoRun).filter(([k]) => k !== screenKey)
                      ) as Partial<Record<WorkspaceScreenKey, boolean>>),
                }
              : r
          )
        : prev
    );
  }, []);

  const toggleCatalogOnPlanningGroup = useCallback(
    (catalogKey: WorkspaceAiMemberId, screenKeys: readonly WorkspaceScreenKey[], checked: boolean) => {
      setAiDirty(true);
      setAiDraft((prev) =>
        prev
          ? prev.map((r) => {
              if (r.catalogKey !== catalogKey) return r;
              let nextKeys = [...r.screenKeys];
              const nextAuto = { ...r.screenAutoRun } as Partial<Record<WorkspaceScreenKey, boolean>>;
              if (checked) {
                for (const sk of screenKeys) {
                  if (!nextKeys.includes(sk)) nextKeys.push(sk);
                  nextAuto[sk] = true;
                }
              } else {
                const drop = new Set(screenKeys);
                nextKeys = nextKeys.filter((k) => !drop.has(k));
                for (const sk of screenKeys) {
                  delete nextAuto[sk];
                }
              }
              return { ...r, screenKeys: nextKeys, screenAutoRun: nextAuto };
            })
          : prev
      );
    },
    []
  );

  const toggleScreenAutoRun = useCallback((catalogKey: WorkspaceAiMemberId, screenKey: WorkspaceScreenKey, autoRun: boolean) => {
    setAiDirty(true);
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
          autoRun: true,
        }));
        const forcedEnabled = catalogKey === "memo" ? true : (row?.enabled ?? true);
        const uiEngine = row?.uiEngine ?? "USER_DEFAULT";
        const uiModel = row?.uiModel ?? "USER_DEFAULT";
        const persisted = persistPrefsFromUi({ catalogKey, uiEngine, uiModel });
        return {
          catalogKey,
          enabled: forcedEnabled,
          screens,
          enginePreference: persisted.graphEnginePreference,
          agentUi: { engine: uiEngine, model: uiModel },
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
      setAiDirty(false);
      setAiAutoSaveTick((t) => t + 1);
      await loadWorkspaceAiGraph();
    } catch {
      setBanner({ text: "AI 설정 저장 중 오류가 발생했습니다.", tone: "neutral" });
    } finally {
      setAiSaveBusy(false);
    }
  }, [projectId, aiDraft, canAdminWorkspaceAi, loadWorkspaceAiGraph]);

  const uiAiCatalog = useMemo(() => {
    // 화면별 참여 AI(화면 목록)에서 작업메모(memo)는 숨김 처리
    const hidden = new Set<WorkspaceAiMemberId>(["memo"]);
    return listPlatformAiMemberCatalog()
      .filter((m) => !hidden.has(m.id))
      .map((m) => ({
        uiId: m.id,
        memberIds: [m.id],
        title: agentTitleForUi(m.title),
        catalog: m,
      }));
  }, []);

  // 변경 즉시 자동 저장 (디바운스)
  useEffect(() => {
    if (tab !== "ai") return;
    if (!canAdminWorkspaceAi) return;
    if (!aiDraft) return;
    if (!aiDirty) return;
    const t = window.setTimeout(() => {
      void saveWorkspaceAiGraph();
    }, 900);
    return () => window.clearTimeout(t);
  }, [tab, canAdminWorkspaceAi, aiDraft, aiDirty, saveWorkspaceAiGraph, aiAutoSaveTick]);

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
        <span aria-hidden />
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
          이해관계자
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
          AI Agent
        </button>
      </div>

      {tab === "people" ? (
        <div>
          {loadState === "loading" ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>불러오는 중…</p>
          ) : loadError ? (
            <p style={{ color: "#b91c1c", fontSize: 14 }}>{loadError}</p>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "46%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px" }}>
                      <button
                        type="button"
                        onClick={() => toggleMemberSort("displayName")}
                        style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", fontWeight: 900, color: "#64748b", whiteSpace: "nowrap" }}
                        aria-label="닉네임 정렬"
                        title="정렬"
                      >
                        닉네임 {memberSortKey === "displayName" ? (memberSortDir === "asc" ? "▲" : "▼") : ""}
                      </button>
                    </th>
                    <th style={{ padding: "10px 12px" }}>
                      <button
                        type="button"
                        onClick={() => toggleMemberSort("email")}
                        style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", fontWeight: 900, color: "#64748b", whiteSpace: "nowrap" }}
                        aria-label="이메일 정렬"
                        title="정렬"
                      >
                        이메일 {memberSortKey === "email" ? (memberSortDir === "asc" ? "▲" : "▼") : ""}
                      </button>
                    </th>
                    <th style={{ padding: "10px 12px" }}>
                      <button
                        type="button"
                        onClick={() => toggleMemberSort("status")}
                        style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", fontWeight: 900, color: "#64748b", whiteSpace: "nowrap" }}
                        aria-label="로그인 상태 정렬"
                        title="정렬"
                      >
                        로그인 상태 {memberSortKey === "status" ? (memberSortDir === "asc" ? "▲" : "▼") : ""}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paddedHumanMembers.map((m, idx) => {
                    if (!m) {
                      return (
                        <tr key={`blank-${idx}`} style={{ borderTop: "1px solid #f1f5f9", height: 44 }}>
                          <td style={{ padding: "10px 12px", color: "transparent" }}>—</td>
                          <td style={{ padding: "10px 12px", color: "transparent" }}>—</td>
                          <td style={{ padding: "10px 12px", color: "transparent" }}>—</td>
                        </tr>
                      );
                    }
                    const name = (m.displayName || m.email || "멤버").trim();
                    const status = m.userId ? "가입됨" : "초대됨";
                    return (
                      <tr key={m.memberId} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</td>
                        <td style={{ padding: "10px 12px", color: "#475569", wordBreak: "break-word", overflowWrap: "anywhere" }}>{m.email ?? "—"}</td>
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontWeight: 800, color: status === "가입됨" ? "#166534" : "#9a3412" }}>
                          {status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!sortedHumanMembers.length ? (
                <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>등록된 이해관계자가 없습니다.</div>
              ) : null}
            </div>
          )}

          <p
            style={{
              fontSize: isNarrow ? 14 : 13,
              color: "#64748b",
              margin: "18px 0 12px",
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
          {/* joinPath는 복사용으로만 사용하고 화면에는 노출하지 않습니다. */}
        </div>
      ) : (
        <div>
          {!canAdminWorkspaceAi ? (
            <p style={{ fontSize: isNarrow ? 14 : 13, color: "#92400e", margin: "0 0 12px", fontWeight: 700, lineHeight: 1.5 }}>
              AI 설정 저장은 프로젝트 소유자만 할 수 있습니다. 조회는 멤버 누구나 가능합니다.
            </p>
          ) : null}
          {aiGraphLoadState === "loading" ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>AI 설정을 불러오는 중…</p>
          ) : aiGraphError ? (
            <p style={{ color: "#b91c1c", fontSize: 14 }}>{aiGraphError}</p>
          ) : !aiDraft ? (
            <p style={{ color: "#64748b", fontSize: 14 }}>AI 설정이 없습니다.</p>
          ) : (
            <>
              <div
                style={{
                  overflowX: isNarrow ? "hidden" : "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: "#fff",
                  marginBottom: 12,
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: isNarrow ? 12 : 13,
                    tableLayout: "fixed",
                  }}
                >
                  <colgroup>
                    <col style={{ width: isNarrow ? "34%" : "36%" }} />
                    <col style={{ width: isNarrow ? "33%" : "32%" }} />
                    <col style={{ width: isNarrow ? "33%" : "32%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th
                        style={{
                          padding: isNarrow ? "8px 4px" : "10px 8px",
                          fontWeight: 800,
                          color: "#64748b",
                          fontSize: isNarrow ? 10 : 11,
                        }}
                      >
                        Agent
                      </th>
                      <th
                        style={{
                          padding: isNarrow ? "8px 4px" : "10px 8px",
                          fontWeight: 800,
                          color: "#64748b",
                          fontSize: isNarrow ? 10 : 11,
                        }}
                      >
                        엔진
                      </th>
                      <th
                        style={{
                          padding: isNarrow ? "8px 4px" : "10px 8px",
                          fontWeight: 800,
                          color: "#64748b",
                          fontSize: isNarrow ? 10 : 11,
                        }}
                      >
                        모델
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {uiAiCatalog.map((uiRow) => {
                      const primaryId = uiRow.uiId;
                      const memberIds = uiRow.memberIds;
                      const draftRows = memberIds.map((id) => aiDraft.find((r) => r.catalogKey === id)).filter(Boolean) as AiDraftMemberRow[];
                      const draft = draftRows[0];
                      const uiEngine = draft?.uiEngine ?? "USER_DEFAULT";
                      const uiModel = draft?.uiModel ?? "USER_DEFAULT";
                      const engineOpts = projectAiAgentEngineChoices(primaryId);
                      const modelOpts: ProjectAiAgentUiModel[] =
                        uiEngine === "USER_DEFAULT"
                          ? ["USER_DEFAULT"]
                          : uiEngine === "CURSOR"
                            ? ["cursor-default"]
                            : [...PROJECT_AI_OPENAI_MODELS];
                      const agentTitle = uiRow.title;
                      const cellPad = isNarrow ? "8px 4px" : "10px 8px";
                      const selectStyle: CSSProperties = {
                        width: "100%",
                        maxWidth: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                        padding: isNarrow ? "2px 4px" : "2px 6px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: isNarrow ? 10 : 11,
                        fontWeight: 600,
                        background: "#fff",
                      };
                      return (
                        <tr key={primaryId} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: cellPad, verticalAlign: "middle", wordBreak: "keep-all" }}>
                            <button
                              type="button"
                              onClick={() => setAiDetailMemberId(primaryId)}
                              title={agentTitle}
                              aria-label={`${agentTitle} 상세보기`}
                              style={{
                                border: 0,
                                background: "transparent",
                                padding: 0,
                                margin: 0,
                                fontWeight: 900,
                                color: "#0f172a",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: isNarrow ? 6 : 8,
                                width: "100%",
                                minWidth: 0,
                                textAlign: "left",
                              }}
                            >
                              <span
                                style={{
                                  flex: "1 1 auto",
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  fontSize: isNarrow ? 12 : 13,
                                }}
                              >
                                {agentTitle}
                              </span>
                              <span style={{ flexShrink: 0 }}>
                                <WorkspaceAiMemberAvatar memberId={primaryId} size={isNarrow ? 18 : 22} />
                              </span>
                            </button>
                            {draft?.cursorPolicyWarn ? (
                              <div
                                style={{
                                  marginTop: 6,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: "#b45309",
                                  maxWidth: "100%",
                                  lineHeight: 1.35,
                                }}
                              >
                                Cursor는 개발자 Agent에서만 사용할 수 있습니다. 저장 시 OpenAI로 보정됩니다.
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: cellPad, color: "#475569", verticalAlign: "middle" }}>
                            {canAdminWorkspaceAi ? (
                              <select
                                value={uiEngine}
                                onChange={(e) => {
                                  setUiEngine(primaryId, e.target.value as ProjectAiAgentUiEngine);
                                }}
                                style={selectStyle}
                              >
                                {engineOpts.map((ek) => (
                                  <option key={ek} value={ek}>
                                    {uiEngineLabel(ek)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span style={{ fontWeight: 600, fontSize: isNarrow ? 10 : 11, wordBreak: "break-word" }}>
                                {uiEngineLabel(uiEngine)}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: cellPad, color: "#475569", verticalAlign: "middle" }}>
                            {canAdminWorkspaceAi ? (
                              <select
                                value={modelOpts.includes(uiModel) ? uiModel : modelOpts[0]}
                                onChange={(e) => {
                                  setUiModel(primaryId, e.target.value as ProjectAiAgentUiModel);
                                }}
                                style={selectStyle}
                              >
                                {modelOpts.map((mk) => (
                                  <option key={mk} value={mk}>
                                    {uiModelLabel(mk)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span style={{ fontWeight: 600, fontSize: isNarrow ? 10 : 11, wordBreak: "break-word" }}>
                                {uiModelLabel(uiModel)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 22px", lineHeight: 1.55 }}>
                엔진은 실행 Provider, 모델은 해당 엔진에서 사용할 기본 모델입니다.
              </p>

              <h2 style={{ fontSize: isNarrow ? 15 : 16, fontWeight: 900, color: "#0f172a", margin: "0 0 10px" }}>절차 별 참여 AI</h2>
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
                        절차
                      </th>
                      {uiAiCatalog.map((uiRow) => (
                        <th
                          key={uiRow.uiId}
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
                          {uiRow.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {WORKSPACE_AI_AGENT_PROCEDURE_TABLE_ROWS.map((procedureRow) => {
                      if (procedureRow.type === "group") {
                        const keys = procedureRow.screenKeys;
                        return (
                          <tr key={procedureRow.rowKey} style={{ borderTop: "1px solid #f1f5f9" }}>
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
                              {procedureRow.label}
                            </td>
                            {uiAiCatalog.map((uiRow) => {
                              const memberIds = uiRow.memberIds;
                              const present = keys.map((sk) =>
                                memberIds.some((id) => aiDraft.find((r) => r.catalogKey === id)?.screenKeys.includes(sk))
                              );
                              const all = present.length > 0 && present.every(Boolean);
                              const some = present.some(Boolean);
                              const disabled = !canAdminWorkspaceAi || !isWorkspaceAiMemberEnabled(uiRow.uiId);
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
                                <td
                                  key={uiRow.uiId}
                                  style={{ padding: isNarrow ? "6px 4px" : "6px 4px", textAlign: "center", verticalAlign: "middle" }}
                                >
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                    <label
                                      title="아이디어 구체화·액터/서비스 흐름·기능 정리 화면에 동시에 참여합니다."
                                      style={labelStyle}
                                    >
                                      <input
                                        ref={(el) => {
                                          if (el) el.indeterminate = some && !all;
                                        }}
                                        type="checkbox"
                                        checked={all}
                                        disabled={disabled}
                                        onChange={(e) => {
                                          toggleCatalogOnPlanningGroup(uiRow.uiId, keys, e.target.checked);
                                        }}
                                        style={{
                                          width: cb,
                                          height: cb,
                                          accentColor: "#0d9488",
                                          cursor: disabled ? "not-allowed" : "pointer",
                                          flexShrink: 0,
                                        }}
                                      />
                                    </label>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      }
                      const screenKey = procedureRow.screenKey;
                      const screenLabel = WORKSPACE_SCREEN_LABEL[screenKey];
                      return (
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
                            {screenLabel}
                          </td>
                          {uiAiCatalog.map((uiRow) => {
                            const memberIds = uiRow.memberIds;
                            const checked = memberIds.some((id) =>
                              aiDraft.find((r) => r.catalogKey === id)?.screenKeys.includes(screenKey)
                            );
                            const disabled = !canAdminWorkspaceAi || !isWorkspaceAiMemberEnabled(uiRow.uiId);
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
                              <td
                                key={uiRow.uiId}
                                style={{ padding: isNarrow ? "6px 4px" : "6px 4px", textAlign: "center", verticalAlign: "middle" }}
                              >
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                  <label title="참여 시 자동실행을 포함합니다." style={labelStyle}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={(e) => {
                                        toggleCatalogOnScreen(uiRow.uiId, screenKey, e.target.checked);
                                      }}
                                      style={{
                                        width: cb,
                                        height: cb,
                                        accentColor: "#0d9488",
                                        cursor: disabled ? "not-allowed" : "pointer",
                                        flexShrink: 0,
                                      }}
                                    />
                                  </label>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
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
