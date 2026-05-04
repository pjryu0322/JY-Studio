"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceParticipants } from "@/components/workspace/useWorkspaceParticipants";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { sessionUserFromAuthMe, type AuthMeDataWire } from "@/lib/user/platformProfile";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { MemberRow, RequirementsWorkspaceStage, SessionUser } from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { WorkspaceAiGraphMemberWire } from "@/lib/workspace-ai/workspaceAiGraphWire";
import { resolveEnabledCatalogKeysForScreen, type WorkspaceScreenKey } from "@/lib/workspace-ai/workspaceScreenKeys";

/**
 * 프로젝트 멤버 API + 세션 + AI 연결 상태로 `useWorkspaceParticipants`와 동일 규칙의 목록을 만듭니다.
 * (요구사항 워크스페이스 외 — 기능 정리 등에서 재사용)
 */
export function useProjectWorkspaceParticipants(params: {
  readonly projectId: string;
  readonly activeStage: RequirementsWorkspaceStage;
  /** 기능 정리·실행 등 — `activeStage`만으로는 부족할 때 전담 AI 컨텍스트 지정 */
  readonly participantContextKey?: WorkspaceAiMemberId;
  /** 이 화면에 참여하는 플랫폼 AI(명시 시 `workspaceParticipantScreenKey`보다 우선) */
  readonly participantContextKeys?: readonly WorkspaceAiMemberId[];
  /** 설정된 경우 프로젝트 AI 그래프를 불러와 해당 화면 참여자를 계산 */
  readonly workspaceParticipantScreenKey?: WorkspaceScreenKey;
  /** 마지막 AI 호출 결과를 반영하려면 부모에서 전달(없으면 null) */
  readonly aiLastInvoke?: { readonly ok: boolean; readonly at: string; readonly detail?: string } | null;
  readonly aiInvokePending?: boolean;
  readonly platformMemberActivity?: Partial<
    Record<WorkspaceAiMemberId, { readonly recentSnippet?: string; readonly statusHint?: string }>
  >;
}) {
  const {
    projectId,
    activeStage,
    participantContextKey,
    participantContextKeys: participantContextKeysParam,
    workspaceParticipantScreenKey,
    aiLastInvoke = null,
    aiInvokePending = false,
    platformMemberActivity,
  } = params;
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [workspaceAiGraph, setWorkspaceAiGraph] = useState<WorkspaceAiGraphMemberWire[] | null>(null);
  const [aiConnPhase, setAiConnPhase] = useState<"checking" | "ready" | "no_key" | "error">("checking");
  const [aiConnDetail, setAiConnDetail] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      try {
        const res = await credentialsIncludeFetch("/api/auth/me");
        const json = (await res.json()) as { success?: boolean; data?: AuthMeDataWire | null };
        if (res.ok && json.success && json.data && String(json.data.id ?? "").trim()) {
          setSessionUser(sessionUserFromAuthMe(json.data));
        } else setSessionUser(null);
      } catch {
        setSessionUser(null);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setAiConnPhase("checking");
      setAiConnDetail(undefined);
      try {
        const pid = projectId.trim();
        const url = pid
          ? `/api/requirements/ai-connection?projectId=${encodeURIComponent(pid)}`
          : "/api/requirements/ai-connection";
        const res = await credentialsIncludeFetch(url);
        const json = (await res.json()) as {
          success?: boolean;
          message?: string;
          data?: { connected?: boolean; code?: string; message?: string };
        };
        if (cancelled) return;
        if (!res.ok || json.success === false) {
          setAiConnPhase("error");
          setAiConnDetail(json.message || `HTTP ${res.status}`);
          return;
        }
        const d = json.data;
        if (!d) {
          setAiConnPhase("error");
          setAiConnDetail("응답 형식 오류");
          return;
        }
        if (d.connected) {
          setAiConnPhase("ready");
          setAiConnDetail(undefined);
        } else if (d.code === "NO_KEY") {
          setAiConnPhase("no_key");
          setAiConnDetail(d.message);
        } else {
          setAiConnPhase("error");
          setAiConnDetail(d.message);
        }
      } catch {
        if (!cancelled) {
          setAiConnPhase("error");
          setAiConnDetail("네트워크 오류");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const reloadMembers = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) {
      setMembers([]);
      return;
    }
    const res = await credentialsIncludeFetch(`/api/project/members?projectId=${encodeURIComponent(pid)}`);
    const json = (await res.json()) as { success?: boolean; data?: MemberRow[] };
    if (!res.ok || !json.success || !Array.isArray(json.data)) {
      setMembers([]);
      return;
    }
    setMembers(json.data);
  }, [projectId]);

  useEffect(() => {
    void reloadMembers();
  }, [reloadMembers]);

  useEffect(() => {
    const pid = projectId.trim();
    if (!pid || !workspaceParticipantScreenKey) {
      setWorkspaceAiGraph(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await credentialsIncludeFetch(`/api/project/workspace-ai?projectId=${encodeURIComponent(pid)}`);
        const json = (await res.json()) as { success?: boolean; data?: { members?: WorkspaceAiGraphMemberWire[] } };
        if (cancelled) return;
        if (!res.ok || !json.success || !json.data?.members) {
          setWorkspaceAiGraph(null);
          return;
        }
        setWorkspaceAiGraph(json.data.members);
      } catch {
        if (!cancelled) setWorkspaceAiGraph(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, workspaceParticipantScreenKey]);

  const workspaceScreenAiMemberIds = useMemo((): readonly WorkspaceAiMemberId[] | undefined => {
    if (!workspaceParticipantScreenKey || !workspaceAiGraph) return undefined;
    return resolveEnabledCatalogKeysForScreen(workspaceAiGraph, workspaceParticipantScreenKey);
  }, [workspaceParticipantScreenKey, workspaceAiGraph]);

  const effectiveParticipantContextKeys = useMemo((): readonly WorkspaceAiMemberId[] | undefined => {
    if (participantContextKeysParam !== undefined) return participantContextKeysParam;
    return workspaceScreenAiMemberIds;
  }, [participantContextKeysParam, workspaceScreenAiMemberIds]);

  const aiPlannerStatusLabel = useMemo(() => {
    if (aiInvokePending) return "응답 대기 중(OpenAI 호출 중)";
    if (aiConnPhase === "checking") return "연결 확인 중…";
    if (aiConnPhase === "no_key") return "연결 확인 필요(API 키 없음)";
    if (aiConnPhase === "error") {
      const d = (aiConnDetail ?? "").trim();
      return d ? `연결 실패: ${d.slice(0, 72)}${d.length > 72 ? "…" : ""}` : "연결 실패";
    }
    if (aiConnPhase === "ready") {
      if (aiLastInvoke && !aiLastInvoke.ok) return "연결됨 · 마지막 호출 실패";
      if (aiLastInvoke?.ok) return "연결됨 · 마지막 응답 성공";
      return "연결됨 · 호출 전";
    }
    return "대기";
  }, [aiConnPhase, aiConnDetail, aiInvokePending, aiLastInvoke]);

  const { participants, participantBadgeCount } = useWorkspaceParticipants({
    members,
    sessionUser,
    activeStage,
    aiPlannerStatusLabel,
    participantContextKeys: effectiveParticipantContextKeys,
    participantContextKey,
    platformMemberActivity,
  });

  return { members, sessionUser, reloadMembers, participants, participantBadgeCount, workspaceScreenAiMemberIds };
}
