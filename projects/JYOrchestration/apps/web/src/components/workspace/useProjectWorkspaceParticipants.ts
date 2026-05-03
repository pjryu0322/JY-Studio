"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceParticipants } from "@/components/workspace/useWorkspaceParticipants";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import type { MemberRow, RequirementsWorkspaceStage, SessionUser } from "@/lib/requirements/requirementsWorkspaceHelpers";

/**
 * 프로젝트 멤버 API + 세션 + AI 연결 상태로 `useWorkspaceParticipants`와 동일 규칙의 목록을 만듭니다.
 * (요구사항 워크스페이스 외 — 기능 정리 등에서 재사용)
 */
export function useProjectWorkspaceParticipants(params: {
  readonly projectId: string;
  readonly activeStage: RequirementsWorkspaceStage;
  /** 마지막 AI 호출 결과를 반영하려면 부모에서 전달(없으면 null) */
  readonly aiLastInvoke?: { readonly ok: boolean; readonly at: string; readonly detail?: string } | null;
  readonly aiInvokePending?: boolean;
}) {
  const { projectId, activeStage, aiLastInvoke = null, aiInvokePending = false } = params;
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [aiConnPhase, setAiConnPhase] = useState<"checking" | "ready" | "no_key" | "error">("checking");
  const [aiConnDetail, setAiConnDetail] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      try {
        const res = await credentialsIncludeFetch("/api/auth/me");
        const json = (await res.json()) as { success?: boolean; data?: SessionUser | null };
        if (res.ok && json.success && json.data) setSessionUser(json.data);
        else setSessionUser(null);
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
        const res = await credentialsIncludeFetch("/api/requirements/ai-connection");
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
  }, []);

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
  });

  return { members, sessionUser, reloadMembers, participants, participantBadgeCount };
}
