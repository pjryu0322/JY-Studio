"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { TaskItem } from "@/components/project-spec/types";
import type { GitChangeRequestItem, TaskPromptItem } from "@/components/task/TaskListSection";
import type { ProjectRole } from "@/lib/auth/roles";
import type { AiMemberActionTypeId } from "@/lib/ai-member/aiMemberActionTypes";

export type ProjectMemberUiRow = {
  memberId: string;
  userId: string | null;
  displayName: string;
  role: ProjectRole;
  memberType: "HUMAN" | "AI";
  aiProvider: string | null;
  isOwner: boolean;
};

type AiActionRow = {
  id: string;
  actionType: string;
  status: string;
  executionMode: string;
  taskId: string | null;
  gitChangeRequestId: string | null;
  requestedAt: string;
  requestedByUserId: string;
  targetMember: { displayName: string | null; role: string };
};

type ProjectMembersSectionProps = {
  projectId: string;
  members: ProjectMemberUiRow[];
  canManageMembers: boolean;
  onChanged: () => Promise<void>;
  tasks?: TaskItem[];
  gitRequests?: GitChangeRequestItem[];
  taskPrompts?: TaskPromptItem[];
  canRequestAiMemberAction?: boolean;
  canRequestAiReviewAction?: boolean;
  /** 액션 수정(스텁/완료) 권한 판별용 */
  currentProjectRole?: ProjectRole | null;
  currentUserId?: string | null;
};

const ROLE_OPTIONS: ProjectRole[] = ["OWNER", "EDITOR", "REVIEWER", "VIEWER"];

function statusBadgeStyle(status: string): CSSProperties {
  const base: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
  };
  switch (status) {
    case "DONE":
      return { ...base, background: "#dcfce7", color: "#166534" };
    case "FAILED":
      return { ...base, background: "#fee2e2", color: "#991b1b" };
    case "IN_PROGRESS":
      return { ...base, background: "#fef9c3", color: "#854d0e" };
    case "CANCELED":
      return { ...base, background: "#f3f4f6", color: "#4b5563" };
    default:
      return { ...base, background: "#e0f2fe", color: "#0369a1" };
  }
}

export function ProjectMembersSection({
  projectId,
  members,
  canManageMembers,
  onChanged,
  tasks = [],
  gitRequests = [],
  taskPrompts = [],
  canRequestAiMemberAction = false,
  canRequestAiReviewAction = false,
  currentProjectRole = null,
  currentUserId = null,
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

  const [aiActions, setAiActions] = useState<AiActionRow[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestMemberId, setRequestMemberId] = useState<string | null>(null);
  const [requestActionType, setRequestActionType] = useState<AiMemberActionTypeId>("SUMMARY_REQUEST");
  const [requestTaskId, setRequestTaskId] = useState("");
  const [requestGitId, setRequestGitId] = useState("");
  const [requestPromptId, setRequestPromptId] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);

  const canAnyAiRequest = canRequestAiMemberAction || canRequestAiReviewAction;

  function canPatchListedAction(a: AiActionRow): boolean {
    if (currentUserId && a.requestedByUserId === currentUserId) {
      return true;
    }
    const role = currentProjectRole;
    if (!role) return false;
    if (role === "OWNER" || role === "EDITOR") return true;
    if (role === "REVIEWER") return a.actionType === "REVIEW_REQUEST";
    return false;
  }

  const reloadActions = useCallback(async () => {
    if (!projectId) return;
    setActionsLoading(true);
    try {
      const res = await fetch(`/api/ai-member-actions?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; data?: AiActionRow[] };
      if (res.ok && json.success && Array.isArray(json.data)) {
        setAiActions(json.data);
      } else {
        setAiActions([]);
      }
    } catch {
      setAiActions([]);
    } finally {
      setActionsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reloadActions();
  }, [reloadActions]);

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

  const actionOptionsForModal = useMemo(() => {
    const opts: { value: AiMemberActionTypeId; label: string }[] = [];
    if (canRequestAiReviewAction) {
      opts.push({ value: "REVIEW_REQUEST", label: "코드/변경 리뷰" });
    }
    if (canRequestAiMemberAction) {
      opts.push(
        { value: "TASK_DRAFT_REQUEST", label: "Task 초안" },
        { value: "QA_CHECK_REQUEST", label: "QA 점검" },
        { value: "SUMMARY_REQUEST", label: "요약" }
      );
    }
    return opts;
  }, [canRequestAiMemberAction, canRequestAiReviewAction]);

  function openRequestModal(memberId: string, suggested?: AiMemberActionTypeId) {
    setRequestMemberId(memberId);
    const first = actionOptionsForModal[0]?.value ?? "SUMMARY_REQUEST";
    setRequestActionType(suggested ?? first);
    setRequestTaskId(tasks[0]?.id ?? "");
    setRequestGitId(gitRequests[0]?.id ?? "");
    setRequestPromptId("");
    setRequestOpen(true);
  }

  async function submitAiRequest() {
    if (!requestMemberId || !projectId) return;
    setRequestBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        projectId,
        projectMemberId: requestMemberId,
        actionType: requestActionType,
        executionMode: "STUB",
      };
      if (requestActionType === "REVIEW_REQUEST") {
        if (!requestGitId.trim()) {
          throw new Error("리뷰 요청은 Git 변경 요청을 선택해야 합니다.");
        }
        body.gitChangeRequestId = requestGitId.trim();
        const g = gitRequests.find((x) => x.id === requestGitId);
        if (g) body.taskId = g.taskId;
      } else {
        if (!requestTaskId.trim()) {
          throw new Error("Task를 선택하세요.");
        }
        body.taskId = requestTaskId.trim();
        if (requestPromptId.trim()) {
          body.taskPromptId = requestPromptId.trim();
        }
      }
      const res = await fetch("/api/ai-member-actions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "요청 생성에 실패했습니다.");
      }
      setMessage("AI 멤버 요청이 등록되었습니다.");
      setRequestOpen(false);
      await reloadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setRequestBusy(false);
    }
  }

  async function patchAction(actionId: string, payload: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(`/api/ai-member-actions/${encodeURIComponent(actionId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "상태 변경에 실패했습니다.");
      }
      await reloadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태 변경 중 오류입니다.");
    }
  }

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

  const promptsForTask = useMemo(() => {
    if (!requestTaskId) return [];
    return taskPrompts.filter((p) => p.taskId === requestTaskId);
  }, [taskPrompts, requestTaskId]);

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>멤버 관리</h2>
      <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
        HUMAN / AI 멤버를 프로젝트 단위로 관리합니다. AI 멤버에는 사람(actor)이 액션을 요청할 수 있습니다.
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
            {m.memberType === "AI" && canAnyAiRequest && actionOptionsForModal.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    openRequestModal(
                      m.memberId,
                      m.role === "REVIEWER"
                        ? "REVIEW_REQUEST"
                        : m.role === "EDITOR"
                          ? "TASK_DRAFT_REQUEST"
                          : "QA_CHECK_REQUEST"
                    )
                  }
                >
                  AI 요청…
                </button>
                {m.role === "REVIEWER" && canRequestAiReviewAction ? (
                  <button type="button" onClick={() => openRequestModal(m.memberId, "REVIEW_REQUEST")}>
                    리뷰
                  </button>
                ) : null}
                {m.role === "EDITOR" && canRequestAiMemberAction ? (
                  <>
                    <button type="button" onClick={() => openRequestModal(m.memberId, "TASK_DRAFT_REQUEST")}>
                      초안
                    </button>
                    <button type="button" onClick={() => openRequestModal(m.memberId, "SUMMARY_REQUEST")}>
                      요약
                    </button>
                  </>
                ) : null}
                {(m.role === "VIEWER" || m.role === "EDITOR") && canRequestAiMemberAction ? (
                  <button type="button" onClick={() => openRequestModal(m.memberId, "QA_CHECK_REQUEST")}>
                    점검
                  </button>
                ) : null}
              </>
            ) : null}
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

      {requestOpen && requestMemberId ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #ccc",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <strong>AI 멤버 요청</strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
            <select
              value={requestActionType}
              onChange={(e) => setRequestActionType(e.target.value as AiMemberActionTypeId)}
            >
              {actionOptionsForModal.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {requestActionType === "REVIEW_REQUEST" ? (
              <select value={requestGitId} onChange={(e) => setRequestGitId(e.target.value)}>
                <option value="">Git 변경 요청 선택</option>
                {gitRequests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id.slice(0, 8)}… / task {g.taskId.slice(0, 8)}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <select value={requestTaskId} onChange={(e) => setRequestTaskId(e.target.value)}>
                  <option value="">Task 선택</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select value={requestPromptId} onChange={(e) => setRequestPromptId(e.target.value)}>
                  <option value="">프롬프트(선택)</option>
                  {promptsForTask.map((p) => (
                    <option key={p.id} value={p.id}>
                      v{p.version} · {p.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button type="button" disabled={requestBusy} onClick={submitAiRequest}>
              {requestBusy ? "처리 중..." : "요청 보내기"}
            </button>
            <button type="button" onClick={() => setRequestOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>AI 멤버 액션 이력</h3>
        {actionsLoading ? (
          <p style={{ fontSize: 13, color: "#666" }}>불러오는 중…</p>
        ) : aiActions.length === 0 ? (
          <p style={{ fontSize: 13, color: "#666" }}>등록된 요청이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {aiActions.slice(0, 30).map((a) => (
              <li
                key={a.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  borderBottom: "1px solid #eee",
                  paddingBottom: 6,
                }}
              >
                <span style={statusBadgeStyle(a.status)}>{a.status}</span>
                <span style={{ fontWeight: 600 }}>{a.actionType}</span>
                <span style={{ color: "#666" }}>
                  → {a.targetMember.displayName ?? a.targetMember.role} ({a.targetMember.role})
                </span>
                <span style={{ color: "#94a3b8", fontSize: 12 }}>{a.requestedAt}</span>
                {canPatchListedAction(a) ? (
                  <>
                    {a.status === "REQUESTED" || a.status === "IN_PROGRESS" ? (
                      <>
                        <button type="button" onClick={() => patchAction(a.id, { runStub: true })}>
                          스텁 완료
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            patchAction(a.id, { status: "DONE", resultPayload: { manual: true } })
                          }
                        >
                          수동 완료
                        </button>
                        <button
                          type="button"
                          onClick={() => patchAction(a.id, { status: "FAILED", errorMessage: "수동 실패" })}
                        >
                          실패 처리
                        </button>
                      </>
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
