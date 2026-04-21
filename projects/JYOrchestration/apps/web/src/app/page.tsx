"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProjectDeleteConfirmModal } from "@/components/project/ProjectDeleteConfirmModal";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { readAiFacilitatorAutoJoin, readAutoOpenLastProject } from "@/lib/preferences/globalPreferences";
import { PROJECT_LIFECYCLE_ACTIVE, PROJECT_LIFECYCLE_DELETED } from "@/lib/project/projectLifecycle";
import { APP_FLOW_LAST_PROJECT_KEY } from "@/lib/workflow/flow-state";

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
  const [highlightProjectId, setHighlightProjectId] = useState<string | null>(null);
  const [createToast, setCreateToast] = useState(false);
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
          includeDefaultAiPlanner: readAiFacilitatorAutoJoin(),
        }),
      });

      const json = (await res.json()) as ApiResponse<Project | null>;

      if (!res.ok || !json.success || !json.data?.id) {
        setErrorMessage(json.message || "프로젝트 생성에 실패했습니다.");
        return;
      }

      const newId = json.data.id;

      setName("");
      setDescription("");
      await loadProjects();
      setHighlightProjectId(newId);
      setCreateToast(true);
      /** 최근 프로젝트 키만 갱신(자동 열기는 프로젝트 허브로). 생성 직후 아이디어 화면으로 보내지 않음 — readAutoEnterAfterCreate는 사용하지 않음. */
      try {
        sessionStorage.setItem(APP_FLOW_LAST_PROJECT_KEY, newId);
      } catch {
        /* ignore */
      }
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

  useEffect(() => {
    if (!highlightProjectId) return;
    const t = window.setTimeout(() => setHighlightProjectId(null), 10_000);
    return () => window.clearTimeout(t);
  }, [highlightProjectId]);

  useEffect(() => {
    if (!createToast) return;
    const t = window.setTimeout(() => setCreateToast(false), 5000);
    return () => window.clearTimeout(t);
  }, [createToast]);

  /** 설정「최근 프로젝트 자동 열기」: 외부·직접 진입 등에서만 세션의 마지막 프로젝트로 이동(앱 내부에서 홈으로 온 경우는 제외). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!readAutoOpenLastProject()) return;
    try {
      const ref = document.referrer;
      if (ref) {
        const u = new URL(ref);
        if (u.origin === window.location.origin) {
          const p = u.pathname;
          if (p !== "/" && !p.startsWith("/login")) return;
        }
      }
    } catch {
      /* allow auto-open */
    }
    let last = "";
    try {
      last = sessionStorage.getItem(APP_FLOW_LAST_PROJECT_KEY) ?? "";
    } catch {
      return;
    }
    const id = last.trim();
    if (!id) return;
    router.replace(`/projects/${encodeURIComponent(id)}`);
  }, [router]);

  return (
    <main
      className="relative"
      style={{
        padding: "8px 24px 20px",
        maxWidth: 1200,
        margin: "0 auto",
      }}
      data-ui-label="[A] Home"
    >
      <ScreenLabel label="워크스페이스-홈-메인-섹션" visible={showScreenLabels} />

      {createToast ? (
        <div
          role="status"
          data-testid="home-project-created-toast"
          style={{
            position: "fixed",
            top: 72,
            right: 24,
            zIndex: 60,
            padding: "10px 16px",
            borderRadius: 10,
            background: "#0f766e",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            boxShadow: "0 12px 32px -8px rgba(15, 118, 110, 0.45)",
          }}
        >
          프로젝트가 생성되었습니다
        </div>
      ) : null}

      <section
        className="relative mx-auto mb-5 box-border w-full max-w-2xl rounded-xl border border-neutral-200 bg-white p-6"
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
        className="relative mx-auto mb-6 box-border w-full max-w-2xl rounded-xl border border-neutral-200 bg-white p-6"
        data-ui-label="[C] Project List"
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
                data-testid={`project-card-${project.id}`}
                data-project-highlight={highlightProjectId === project.id ? "1" : undefined}
                style={{
                  border: highlightProjectId === project.id ? "2px solid #0d9488" : "1px solid #e5e5e5",
                  borderRadius: 10,
                  padding: 16,
                  background: highlightProjectId === project.id ? "#f0fdfa" : undefined,
                  boxShadow: highlightProjectId === project.id ? "0 0 0 3px rgba(13, 148, 136, 0.2)" : undefined,
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
                      href={`/projects/${encodeURIComponent(project.id)}`}
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