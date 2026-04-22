"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchExecutionSetup } from "@/components/project-spec/api";
import { computeProjectExecutionReadiness } from "@/components/project/projectExecutionReadinessModel";
import { ProjectDeleteConfirmModal } from "@/components/project/ProjectDeleteConfirmModal";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { readAiFacilitatorAutoJoin, readAutoOpenLastProject } from "@/lib/preferences/globalPreferences";
import { PROJECT_LIFECYCLE_ACTIVE, PROJECT_LIFECYCLE_DELETED } from "@/lib/project/projectLifecycle";
import { APP_FLOW_LAST_PROJECT_KEY } from "@/lib/workflow/flow-state";

function ProjectCardSettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

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
  /** 홈 카드 상태 배지 인라인 팝오버(한 번에 하나만) */
  const [statusPopoverProjectId, setStatusPopoverProjectId] = useState<string | null>(null);
  const [statusPopoverLoading, setStatusPopoverLoading] = useState(false);
  const [statusPopoverError, setStatusPopoverError] = useState<string | null>(null);
  const [statusPopoverReadiness, setStatusPopoverReadiness] = useState<ReturnType<typeof computeProjectExecutionReadiness> | null>(null);
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
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
      /** 최근 프로젝트 키 갱신(자동 열기 시 아이디어 구체화로 이동). 생성 직후에는 홈에 유지. */
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

  /** 설정「최근 프로젝트 자동 열기」: 외부·직접 진입 등에서만 세션의 마지막 프로젝트 아이디어 구체화 화면으로 이동(앱 내부에서 홈으로 온 경우는 제외). */
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
    router.replace(`/requirements?projectId=${encodeURIComponent(id)}`);
  }, [router]);

  useEffect(() => {
    const pid = statusPopoverProjectId?.trim();
    if (!pid) {
      setStatusPopoverLoading(false);
      setStatusPopoverError(null);
      setStatusPopoverReadiness(null);
      return;
    }
    const row = projectsRef.current.find((p) => p.id === pid);
    if (row?.status === PROJECT_LIFECYCLE_DELETED) {
      setStatusPopoverLoading(false);
      setStatusPopoverError(null);
      setStatusPopoverReadiness(null);
      return;
    }
    let cancelled = false;
    setStatusPopoverLoading(true);
    setStatusPopoverError(null);
    setStatusPopoverReadiness(null);
    void (async () => {
      try {
        const { res, json } = await fetchExecutionSetup(pid);
        if (cancelled) return;
        if (!res.ok || !json.success) {
          setStatusPopoverError(json.message || "실행 환경 정보를 불러오지 못했습니다.");
          setStatusPopoverReadiness(null);
        } else {
          setStatusPopoverReadiness(computeProjectExecutionReadiness(json.data ?? null));
          setStatusPopoverError(null);
        }
      } catch {
        if (!cancelled) {
          setStatusPopoverError("실행 환경 정보를 불러오지 못했습니다.");
          setStatusPopoverReadiness(null);
        }
      } finally {
        if (!cancelled) setStatusPopoverLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statusPopoverProjectId]);

  useEffect(() => {
    if (!statusPopoverProjectId) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      const root = document.querySelector(`[data-home-status-popover-root="${statusPopoverProjectId}"]`);
      if (root instanceof HTMLElement && root.contains(t)) return;
      setStatusPopoverProjectId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStatusPopoverProjectId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [statusPopoverProjectId]);

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
                    alignItems: "flex-start",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <div className="relative" style={{ minWidth: 0, flex: 1 }}>
                    <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드-프로젝트명" visible={showScreenLabels} />
                    <strong>{project.name}</strong>
                  </div>
                  <div className="relative" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <Link
                      href={`/projects/${encodeURIComponent(project.id)}`}
                      data-testid={
                        project.name === "Web Meeting MVP" ? "project-settings-seed" : `project-card-settings-${project.id}`
                      }
                      aria-label="프로젝트 관리 및 설정"
                      title="프로젝트 관리 및 설정"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        color: "#64748b",
                        textDecoration: "none",
                      }}
                    >
                      <ProjectCardSettingsIcon />
                    </Link>
                    <div
                      data-home-status-popover-root={project.id}
                      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
                    >
                      <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드-상태배지" visible={showScreenLabels} />
                      <button
                        type="button"
                        data-testid={`home-project-status-badge-${project.id}`}
                        aria-expanded={statusPopoverProjectId === project.id}
                        aria-haspopup="dialog"
                        aria-label="프로젝트 상태 요약 보기"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusPopoverProjectId((cur) => (cur === project.id ? null : project.id));
                        }}
                        style={{
                          fontSize: 13,
                          color: project.status === PROJECT_LIFECYCLE_DELETED ? "#b91c1c" : "#64748b",
                          fontWeight: project.status === PROJECT_LIFECYCLE_DELETED ? 600 : 500,
                          cursor: "pointer",
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          padding: "6px 10px",
                          background: "#fff",
                          lineHeight: 1.2,
                        }}
                      >
                        {project.status === PROJECT_LIFECYCLE_DELETED ? "삭제됨" : formatProjectStatusForUi(project.status)}
                      </button>
                      {statusPopoverProjectId === project.id ? (
                        <div
                          role="dialog"
                          aria-label="프로젝트 상태"
                          style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            right: 0,
                            zIndex: 50,
                            width: "min(92vw, 280px)",
                            padding: "12px 14px",
                            borderRadius: 10,
                            border: "1px solid #e2e8f0",
                            background: "#fff",
                            boxShadow: "0 14px 40px -12px rgba(15, 23, 42, 0.25)",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>상태 요약</div>
                          <dl
                            style={{
                              margin: 0,
                              display: "grid",
                              gap: 6,
                              fontSize: 12,
                              color: "#334155",
                              gridTemplateColumns: "96px 1fr",
                            }}
                          >
                            <dt style={{ fontWeight: 700, color: "#94a3b8" }}>프로젝트</dt>
                            <dd style={{ margin: 0, fontWeight: 700 }}>
                              {project.status === PROJECT_LIFECYCLE_DELETED ? (
                                <span style={{ color: "#b91c1c" }}>삭제됨</span>
                              ) : (
                                formatProjectStatusForUi(project.status)
                              )}
                            </dd>
                            <dt style={{ fontWeight: 700, color: "#94a3b8" }}>Git 연결</dt>
                            <dd style={{ margin: 0 }}>
                              {project.status === PROJECT_LIFECYCLE_DELETED
                                ? "—"
                                : statusPopoverLoading
                                  ? "불러오는 중…"
                                  : statusPopoverReadiness?.gitLabel ?? (statusPopoverError ? "확인 불가" : "—")}
                            </dd>
                            <dt style={{ fontWeight: 700, color: "#94a3b8" }}>GitHub 인증</dt>
                            <dd style={{ margin: 0 }}>
                              {project.status === PROJECT_LIFECYCLE_DELETED
                                ? "—"
                                : statusPopoverLoading
                                  ? "불러오는 중…"
                                  : statusPopoverReadiness?.githubLabel ?? (statusPopoverError ? "확인 불가" : "—")}
                            </dd>
                            <dt style={{ fontWeight: 700, color: "#94a3b8" }}>Cursor 연결</dt>
                            <dd style={{ margin: 0 }}>
                              {project.status === PROJECT_LIFECYCLE_DELETED
                                ? "—"
                                : statusPopoverLoading
                                  ? "불러오는 중…"
                                  : statusPopoverReadiness?.cursorLabel ?? (statusPopoverError ? "확인 불가" : "—")}
                            </dd>
                            <dt style={{ fontWeight: 700, color: "#94a3b8" }}>실행 가능</dt>
                            <dd style={{ margin: 0, fontWeight: 800 }}>
                              {project.status === PROJECT_LIFECYCLE_DELETED ? (
                                "—"
                              ) : statusPopoverLoading ? (
                                "불러오는 중…"
                              ) : statusPopoverReadiness ? (
                                <span style={{ color: statusPopoverReadiness.runnable ? "#15803d" : "#b45309" }}>
                                  {statusPopoverReadiness.runnable ? "가능" : "불가"}
                                </span>
                              ) : statusPopoverError ? (
                                <span style={{ color: "#b45309" }}>확인 불가</span>
                              ) : (
                                "—"
                              )}
                            </dd>
                          </dl>
                          {statusPopoverError && project.status !== PROJECT_LIFECYCLE_DELETED ? (
                            <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b91c1c", lineHeight: 1.35 }}>{statusPopoverError}</p>
                          ) : null}
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                            <Link
                              href={`/projects/${encodeURIComponent(project.id)}`}
                              onClick={() => setStatusPopoverProjectId(null)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "1px solid #cbd5e1",
                                background: "#f8fafc",
                                color: "#0f172a",
                                fontSize: 12,
                                fontWeight: 800,
                                textDecoration: "none",
                              }}
                            >
                              설정으로 이동
                            </Link>
                          </div>
                        </div>
                      ) : null}
                    </div>
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