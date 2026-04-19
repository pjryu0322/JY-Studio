"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProjectDeleteConfirmModal } from "@/components/project/ProjectDeleteConfirmModal";
import { ProjectCreateMemberPicker, type PendingProjectInvite } from "@/components/project/ProjectCreateMemberPicker";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { PROJECT_LIFECYCLE_ACTIVE, PROJECT_LIFECYCLE_DELETED } from "@/lib/project/projectLifecycle";

function formatProjectStatusForUi(status: string): string {
  if (status === PROJECT_LIFECYCLE_ACTIVE) return "활성";
  if (status === PROJECT_LIFECYCLE_DELETED) return "삭제됨";
  return status;
}

type Project = {
  id: string;
  name: string;
  description: string | null;
  ownerUserId?: string;
  projectType: string;
  repoUrl: string | null;
  defaultBranch: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export default function HomePage() {
  const showScreenLabels = useShowScreenLabels();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [listMessage, setListMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [includeDeletedProjects, setIncludeDeletedProjects] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingProjectInvite[]>([]);

  const defaultProjectType = "web-service";
  const defaultBranch = "main";

  async function loadSession() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const json = (await res.json()) as ApiResponse<SessionUser | null>;
      if (res.ok && json.success && json.data) {
        setSessionUser(json.data);
      } else {
        setSessionUser(null);
      }
    } catch {
      setSessionUser(null);
    }
  }

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setListMessage(null);
      const q = includeDeletedProjects ? "?includeDeleted=1" : "";
      const res = await fetch(`/api/projects${q}`, { credentials: "include" });
      const json = (await res.json()) as ApiResponse<Project[] | null>;

      if (res.status === 401) {
        setProjects([]);
        setListMessage(json.message || "로그인이 필요합니다.");
        return;
      }

      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setProjects([]);
        setListMessage(json.message || "프로젝트 목록을 불러오지 못했습니다.");
        return;
      }

      setProjects(json.data);
    } catch (error) {
      console.error("Failed to load projects:", error);
      setProjects([]);
      setListMessage("프로젝트 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [includeDeletedProjects]);

  async function invitePendingMembers(projectId: string) {
    for (const p of pendingInvites) {
      if (p.kind === "human") {
        const res = await fetch("/api/project/members/invite", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            memberType: "HUMAN",
            userId: p.user.id,
            role: p.role,
          }),
        });
        if (!res.ok) {
          const j = (await res.json()) as ApiResponse<unknown>;
          console.warn("Member invite failed:", j.message);
        }
      } else {
        const res = await fetch("/api/project/members/invite", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            memberType: "AI",
            displayName: p.displayName,
            role: p.role,
            aiOrchestrationRole: p.aiOrchestrationRole,
            orchestrationStage: p.orchestrationStage,
            aiProvider: "openai",
            orchestrationEnabled: true,
          }),
        });
        if (!res.ok) {
          const j = (await res.json()) as ApiResponse<unknown>;
          console.warn("AI member invite failed:", j.message);
        }
      }
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("프로젝트명을 입력해 주세요.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim(),
          projectType: defaultProjectType,
          repoUrl: null,
          defaultBranch,
        }),
      });

      const json = (await res.json()) as ApiResponse<Project | null>;

      if (!res.ok || !json.success || !json.data?.id) {
        setErrorMessage(json.message || "프로젝트 생성에 실패했습니다.");
        return;
      }

      const newId = json.data.id;
      await invitePendingMembers(newId);

      setName("");
      setDescription("");
      setPendingInvites([]);
      await loadProjects();
      router.push(`/requirements?projectId=${encodeURIComponent(newId)}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      setErrorMessage("프로젝트 생성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  }

  return (
    <main className="relative" style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }} data-ui-label="[A] Home">
      <ScreenLabel label="워크스페이스-홈-메인-섹션" visible={showScreenLabels} />
      <section className="relative" data-ui-label="[A-1] Header" style={{ marginBottom: 24 }}>
        <ScreenLabel label="워크스페이스-홈-헤더-섹션" visible={showScreenLabels} />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>JY 오케스트레이션</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, color: "#444" }}>
              {sessionUser
                ? `${sessionUser.name} (${sessionUser.email})`
                : "…"}
            </span>
            <button
              type="button"
              data-testid="home-logout"
              onClick={() => void handleLogout()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
        <p style={{ margin: 0, color: "#555" }}>
          JY Orchestration은 아이디어를 단계적으로 정리하는 플랫폼이며, 프로토타입은 각 프로젝트에서 만들어지는 결과물입니다.
        </p>
      </section>

      <section
        className="relative mx-auto mb-6 max-w-2xl rounded-xl border border-neutral-200 p-6"
        data-ui-label="[B] Create Project Form"
      >
        <ScreenLabel label="워크스페이스-프로젝트생성-섹션" visible={showScreenLabels} />
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
          새 프로젝트 생성
        </h2>

        <form data-testid="home-create-project-form" className="space-y-3" onSubmit={handleCreateProject}>
          {errorMessage ? (
            <p style={{ color: "#b00020", margin: 0 }}>{errorMessage}</p>
          ) : null}
          <div className="relative">
            <ScreenLabel label="워크스페이스-프로젝트생성-프로젝트명-입력" visible={showScreenLabels} />
            <input
              type="text"
              placeholder="프로젝트명"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              data-testid="home-project-name"
              data-ui-label="[B-1] Project Name"
              className="h-11 w-full rounded-lg border border-neutral-300 px-3 text-base text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-60"
            />
          </div>

          <div className="relative">
            <ScreenLabel label="워크스페이스-프로젝트생성-프로젝트설명-입력영역" visible={showScreenLabels} />
            <textarea
              placeholder="프로젝트 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              data-testid="home-project-description"
              data-ui-label="[B-2] Project Description"
              className="min-h-[120px] w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-base text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-400 disabled:opacity-60"
            />
          </div>

          <ProjectCreateMemberPicker disabled={submitting} pending={pendingInvites} onChangePending={setPendingInvites} />

          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
            생성 후 생성 준비(프로젝트 허브)에서 Git·고급 설정을 이어서 구성할 수 있습니다.
          </p>

          <div className="relative inline-block w-fit">
            <ScreenLabel label="워크스페이스-프로젝트생성-생성버튼" visible={showScreenLabels} />
            <button
              type="submit"
              disabled={submitting}
              data-testid="home-create-project"
              data-ui-label="[B-6] Create Project Submit"
              className="h-10 cursor-pointer rounded-lg border-0 bg-neutral-900 px-4 text-sm font-semibold text-white opacity-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "생성 중..." : "프로젝트 생성"}
            </button>
          </div>
        </form>
      </section>

      <section
        className="relative"
        data-ui-label="[C] Project List"
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <ScreenLabel label="워크스페이스-프로젝트목록-섹션" visible={showScreenLabels} />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>프로젝트 목록</h2>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: "#334155",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              data-testid="home-include-deleted-projects"
              checked={includeDeletedProjects}
              onChange={(e) => setIncludeDeletedProjects(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#2563eb" }}
            />
            삭제된 프로젝트 보기
          </label>
        </div>

        <div className="relative" data-ui-label="[C-1] Project List Content">
        {loading ? (
          <p>불러오는 중...</p>
        ) : listMessage ? (
          <p style={{ color: "#b00020" }}>{listMessage}</p>
        ) : projects.length === 0 ? (
          <p>등록된 프로젝트가 없습니다.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {projects.map((project) => (
              <div
                key={project.id}
                className="relative"
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드" visible={showScreenLabels} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <div className="relative" style={{ minWidth: 0 }}>
                    <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드-프로젝트명" visible={showScreenLabels} />
                    <strong>{project.name}</strong>
                  </div>
                  <div className="relative">
                    <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드-상태배지" visible={showScreenLabels} />
                    <span style={{ fontSize: 13, color: "#64748b" }}>
                      {project.status === PROJECT_LIFECYCLE_DELETED ? (
                        <span style={{ color: "#b91c1c", fontWeight: 600 }}>삭제됨</span>
                      ) : (
                        formatProjectStatusForUi(project.status)
                      )}
                    </span>
                  </div>
                </div>

                <div className="relative" style={{ color: "#555", marginBottom: 8 }}>
                  <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드-설명" visible={showScreenLabels} />
                  {project.description || "설명 없음"}
                </div>

                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {project.repoUrl ? (
                    <>
                      저장소 연결됨 · 브랜치 {project.defaultBranch || "main"}
                    </>
                  ) : (
                    <>저장소 미연결 · 기본 브랜치 {project.defaultBranch || "main"}</>
                  )}
                </div>
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <div className="relative" style={{ display: "inline-block" }}>
                    <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드-상세보기버튼" visible={showScreenLabels} />
                    <Link
                      href={`/requirements?projectId=${encodeURIComponent(project.id)}`}
                      data-testid={
                        project.name === "Web Meeting MVP" ? "project-open-seed" : `project-open-${project.id}`
                      }
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        color: "#111",
                        textDecoration: "none",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      열기
                    </Link>
                  </div>
                  {sessionUser &&
                  project.ownerUserId === sessionUser.id &&
                  project.status !== PROJECT_LIFECYCLE_DELETED ? (
                    <div className="relative" style={{ display: "inline-block" }}>
                      <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드-삭제버튼" visible={showScreenLabels} />
                      <button
                        type="button"
                        data-testid={`home-delete-project-${project.id}`}
                        onClick={() => setDeleteTarget({ id: project.id, name: project.name })}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #fecaca",
                          background: "#fff",
                          color: "#b91c1c",
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </section>
      {process.env.NODE_ENV !== "production" ? (
        <footer style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #eee", fontSize: 13 }}>
          <Link href="/dev/test-results" data-testid="link-test-results" style={{ color: "#2563eb" }}>
            테스트 결과 대시보드 (개발용)
          </Link>
        </footer>
      ) : null}
      {deleteTarget ? (
        <ProjectDeleteConfirmModal
          open={Boolean(deleteTarget)}
          projectId={deleteTarget.id}
          projectName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => void loadProjects()}
        />
      ) : null}
    </main>
  );
}