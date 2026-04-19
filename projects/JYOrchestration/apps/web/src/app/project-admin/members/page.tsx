"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchGeneratedTasks, fetchProjectById } from "@/components/project-spec/api";
import type { Project, TaskItem } from "@/components/project-spec/types";
import { ProjectMembersSection } from "@/components/project-spec/ProjectMembersSection";
import type { ProjectMemberUiRow } from "@/components/project-spec/ProjectMembersSection";
import type { GitChangeRequestItem, TaskPromptItem } from "@/components/task/TaskListSection";
import { RolePermissions } from "@/lib/auth/roles";
import { canManageMembers } from "@/lib/rbac/projectPermissions";
import type { ProjectRole } from "@/lib/rbac/projectPermissions";
import { RBAC_FORBIDDEN_CODE } from "@/lib/rbac/projectAccessDenied";
import { ProjectAdminWorkflowScopeNote } from "@/components/project/ProjectAdminWorkflowScopeNote";

function rbacForbiddenMessage(
  res: Response,
  json: { code?: string; message?: string }
): string | null {
  if (res.status === 403 && json.code === RBAC_FORBIDDEN_CODE && json.message) {
    return json.message;
  }
  return null;
}

function ProjectAdminMembersInner() {
  const searchParams = useSearchParams();
  const projectId = String(searchParams.get("projectId") ?? "").trim();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projectRole, setProjectRole] = useState<ProjectRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberRows, setMemberRows] = useState<ProjectMemberUiRow[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskPrompts, setTaskPrompts] = useState<TaskPromptItem[]>([]);
  const [gitRequests, setGitRequests] = useState<GitChangeRequestItem[]>([]);

  const reloadSessionContext = useCallback(async () => {
    if (!projectId) {
      setProjectRole(null);
      setCurrentUserId(null);
      setMemberRows([]);
      return;
    }
    const res = await fetch(`/api/project/session-context?projectId=${encodeURIComponent(projectId)}`, {
      credentials: "include",
    });
    const json = (await res.json()) as {
      success: boolean;
      data?: {
        myRole: ProjectRole | null;
        currentUserId?: string;
        members: ProjectMemberUiRow[];
      };
    };
    if (!res.ok || !json.success || !json.data) {
      setProjectRole(null);
      setCurrentUserId(null);
      setMemberRows([]);
      return;
    }
    setProjectRole(json.data.myRole);
    setCurrentUserId(json.data.currentUserId ?? null);
    setMemberRows(Array.isArray(json.data.members) ? json.data.members : []);
  }, [projectId]);

  useEffect(() => {
    void reloadSessionContext();
  }, [reloadSessionContext]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setErrorMessage(null);
      setLoading(false);
      setTasks([]);
      setTaskPrompts([]);
      setGitRequests([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);
    void (async () => {
      const { project: p, errorMessage: err } = await fetchProjectById(projectId);
      if (cancelled) return;
      setLoading(false);
      if (err || !p) {
        setProject(null);
        setErrorMessage(err || "프로젝트를 불러오지 못했습니다.");
        return;
      }
      setProject(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function loadTasksAndRelated() {
      try {
        const { res, json } = await fetchGeneratedTasks(projectId);
        const denied = rbacForbiddenMessage(res, json as { code?: string; message?: string });
        if (denied || !res.ok || !json.success || !Array.isArray(json.data)) {
          if (!cancelled) setTasks([]);
        } else if (!cancelled) {
          setTasks(json.data);
        }
      } catch {
        if (!cancelled) setTasks([]);
      }

      try {
        const encodedProjectId = encodeURIComponent(projectId);
        const res = await fetch(`/api/task/prompt?projectId=${encodedProjectId}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          success: boolean;
          code?: string;
          message?: string;
          data?: TaskPromptItem[];
        };
        const denied = rbacForbiddenMessage(res, json);
        if (denied || !res.ok || !json.success || !Array.isArray(json.data)) {
          if (!cancelled) setTaskPrompts([]);
        } else if (!cancelled) {
          setTaskPrompts(json.data);
        }
      } catch {
        if (!cancelled) setTaskPrompts([]);
      }

      try {
        const encodedProjectId = encodeURIComponent(projectId);
        const res = await fetch(`/api/task/git-apply?projectId=${encodedProjectId}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          success: boolean;
          data?: GitChangeRequestItem[];
          code?: string;
          message?: string;
        };
        const denied = rbacForbiddenMessage(res, json);
        if (denied || !res.ok || !json.success || !Array.isArray(json.data)) {
          if (!cancelled) setGitRequests([]);
        } else if (!cancelled) {
          setGitRequests(json.data);
        }
      } catch {
        if (!cancelled) setGitRequests([]);
      }
    }

    void loadTasksAndRelated();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const permissions = useMemo(
    () =>
      projectRole
        ? RolePermissions[projectRole]
        : {
            canViewProject: false,
            canEditProject: false,
            canGenerateTask: false,
            canRunTask: false,
            canReorderTask: false,
            canCreatePrompt: false,
            canRegisterGitRequest: false,
            canApplyGit: false,
            canReviewGit: false,
            canChangeGitPolicy: false,
            canViewExecution: false,
            canControlExecution: false,
            canRequestAiMemberAction: false,
            canRequestAiReviewAction: false,
            canDispatchAiMemberAction: false,
            canEdit: false,
            canRun: false,
            canApprove: false,
            canReorder: false,
            canView: false,
          },
    [projectRole]
  );

  const rbac = useMemo(
    () => ({
      canManageMembers: canManageMembers(projectRole),
    }),
    [projectRole]
  );

  const backHref =
    projectId.trim().length > 0
      ? `/requirements?projectId=${encodeURIComponent(projectId)}`
      : "/";

  return (
    <main data-testid="project-admin-members-page" style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      {projectId ? (
        <div style={{ marginBottom: 16 }}>
          <Link
            href={backHref}
            style={{ fontSize: 14, fontWeight: 700, color: "#1d4ed8", textDecoration: "none" }}
          >
            ← 아이디어 구체화로
          </Link>
        </div>
      ) : null}

      {projectId ? <ProjectAdminWorkflowScopeNote /> : null}

      {!projectId ? (
        <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
          <h1 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>프로젝트 멤버</h1>
          <p style={{ margin: 0 }}>
            프로젝트를 선택한 뒤 이 화면에서 멤버를 추가·제거할 수 있습니다.{" "}
            <Link href="/" style={{ color: "#1d4ed8", fontWeight: 700 }}>
              홈
            </Link>
            에서 프로젝트를 연 다음 <code style={{ fontSize: 12 }}>?projectId=…</code> 로 다시 열어 주세요.
          </p>
        </div>
      ) : null}

      {projectId && loading ? <p style={{ color: "#64748b" }}>불러오는 중…</p> : null}
      {projectId && errorMessage ? (
        <p style={{ color: "#b91c1c", fontWeight: 600 }} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {projectId && project && !errorMessage ? (
        <>
          <header style={{ marginBottom: 18 }}>
            <h1 style={{ margin: "0 0 6px 0", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>프로젝트 멤버</h1>
            <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.55 }}>
              <strong>{project.name}</strong>에 속한 사람·AI 멤버를 관리합니다. 다음 단계는{" "}
              <Link href={backHref} style={{ color: "#1d4ed8", fontWeight: 700 }}>
                아이디어 구체화
              </Link>
              에서 이어가면 됩니다.
            </p>
          </header>

          <ProjectMembersSection
            projectId={projectId}
            members={memberRows}
            canManageMembers={rbac.canManageMembers}
            onChanged={reloadSessionContext}
            tasks={tasks}
            gitRequests={gitRequests}
            taskPrompts={taskPrompts}
            canRequestAiMemberAction={permissions.canRequestAiMemberAction}
            canRequestAiReviewAction={permissions.canRequestAiReviewAction}
            canDispatchAiMemberAction={permissions.canDispatchAiMemberAction}
            currentProjectRole={projectRole}
            currentUserId={currentUserId}
            memberSurface="unified"
            canRunStage2EnvTest={permissions.canEditProject}
            isProjectOwner={projectRole === "OWNER"}
          />
        </>
      ) : null}
    </main>
  );
}

export default function ProjectAdminMembersPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto", color: "#64748b" }}>불러오는 중…</div>
      }
    >
      <ProjectAdminMembersInner />
    </Suspense>
  );
}
