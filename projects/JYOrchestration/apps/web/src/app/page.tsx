"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { fetchExecutionSetup } from "@/components/project-spec/api";
import { computeProjectExecutionReadiness } from "@/components/project/projectExecutionReadinessModel";
import { ProjectDeleteConfirmModal } from "@/components/project/ProjectDeleteConfirmModal";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
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
  requirementsStateJson?: unknown;
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
  const [editDescTarget, setEditDescTarget] = useState<{ id: string; name: string } | null>(null);
  const [editDescValue, setEditDescValue] = useState("");
  const [editDescBusy, setEditDescBusy] = useState(false);
  const [editDescError, setEditDescError] = useState<string | null>(null);
  const [highlightProjectId, setHighlightProjectId] = useState<string | null>(null);
  const [createToast, setCreateToast] = useState(false);
  /** 홈 카드 설정 아이콘 메뉴(상태 요약 + 작업, 한 번에 하나만) */
  const [projectCardMenuId, setProjectCardMenuId] = useState<string | null>(null);
  const [projectCardMenuLoading, setProjectCardMenuLoading] = useState(false);
  const [projectCardMenuError, setProjectCardMenuError] = useState<string | null>(null);
  const [projectCardMenuReadiness, setProjectCardMenuReadiness] = useState<ReturnType<typeof computeProjectExecutionReadiness> | null>(null);
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
    const pid = projectCardMenuId?.trim();
    if (!pid) {
      setProjectCardMenuLoading(false);
      setProjectCardMenuError(null);
      setProjectCardMenuReadiness(null);
      return;
    }
    const row = projectsRef.current.find((p) => p.id === pid);
    if (row?.status === PROJECT_LIFECYCLE_DELETED) {
      setProjectCardMenuLoading(false);
      setProjectCardMenuError(null);
      setProjectCardMenuReadiness(null);
      return;
    }
    let cancelled = false;
    setProjectCardMenuLoading(true);
    setProjectCardMenuError(null);
    setProjectCardMenuReadiness(null);
    void (async () => {
      try {
        const { res, json } = await fetchExecutionSetup(pid);
        if (cancelled) return;
        if (!res.ok || !json.success) {
          setProjectCardMenuError(json.message || "실행 환경 정보를 불러오지 못했습니다.");
          setProjectCardMenuReadiness(null);
        } else {
          setProjectCardMenuReadiness(computeProjectExecutionReadiness(json.data ?? null));
          setProjectCardMenuError(null);
        }
      } catch {
        if (!cancelled) {
          setProjectCardMenuError("실행 환경 정보를 불러오지 못했습니다.");
          setProjectCardMenuReadiness(null);
        }
      } finally {
        if (!cancelled) setProjectCardMenuLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectCardMenuId]);

  useEffect(() => {
    if (!projectCardMenuId) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      const root = document.querySelector(`[data-home-project-card-menu-root="${projectCardMenuId}"]`);
      if (root instanceof HTMLElement && root.contains(t)) return;
      setProjectCardMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProjectCardMenuId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [projectCardMenuId]);

  const openEditDescription = useCallback((project: Project) => {
    const state = parseRequirementsStateJson(project.requirementsStateJson);
    const original = typeof state.originalProjectDescription === "string" ? state.originalProjectDescription : "";
    setEditDescTarget({ id: project.id, name: project.name });
    setEditDescValue(original);
    setEditDescError(null);
    setProjectCardMenuId(null);
  }, []);

  const saveEditDescription = useCallback(async () => {
    if (!editDescTarget) return;
    if (editDescBusy) return;
    setEditDescBusy(true);
    setEditDescError(null);
    try {
      const p = projectsRef.current.find((x) => x.id === editDescTarget.id);
      if (!p) throw new Error("프로젝트를 찾을 수 없습니다.");
      const prevState = parseRequirementsStateJson(p.requirementsStateJson);
      const nextState = mergeRequirementsStateJson(prevState, { originalProjectDescription: editDescValue.trim() });
      const res = await fetch(`/api/projects/${encodeURIComponent(editDescTarget.id)}/spec-workspace`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementsStateJson: nextState }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) throw new Error(json.message || "저장에 실패했습니다.");
      setProjects((cur) =>
        cur.map((row) => (row.id === editDescTarget.id ? { ...row, requirementsStateJson: nextState } : row))
      );
      setEditDescTarget(null);
    } catch (e) {
      setEditDescError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setEditDescBusy(false);
    }
  }, [editDescTarget, editDescBusy, editDescValue]);

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
            {projects.map((project) => {
              const menuOpen = projectCardMenuId === project.id;
              const canOpenProject = project.status !== PROJECT_LIFECYCLE_DELETED;
              const showOwnerDelete =
                Boolean(sessionUser) &&
                project.ownerUserId === sessionUser?.id &&
                project.status !== PROJECT_LIFECYCLE_DELETED;
              const openBtnStyle: CSSProperties = {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #0d9488",
                background: "#ecfdf5",
                color: "#0f766e",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              };
              return (
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexShrink: 0,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {canOpenProject ? (
                      <Link
                        href={`/requirements?projectId=${encodeURIComponent(project.id)}`}
                        data-testid={
                          project.name === "Web Meeting MVP" ? "project-open-seed" : `project-open-${project.id}`
                        }
                        onClick={(e) => e.stopPropagation()}
                        style={openBtnStyle}
                      >
                        열기
                      </Link>
                    ) : null}
                    {showOwnerDelete ? (
                      <div className="relative">
                        <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드-삭제버튼" visible={showScreenLabels} />
                        <button
                          type="button"
                          data-testid={`home-delete-project-${project.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: project.id, name: project.name });
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #fecaca",
                            background: "#fff",
                            color: "#b91c1c",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    ) : null}
                    <div data-home-project-card-menu-root={project.id} className="relative">
                    <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드-메뉴" visible={showScreenLabels} />
                    <button
                      type="button"
                      data-testid={
                        project.name === "Web Meeting MVP" ? "project-settings-seed" : `project-card-settings-${project.id}`
                      }
                      aria-expanded={menuOpen}
                      aria-haspopup="dialog"
                      aria-label="프로젝트 메뉴"
                      title="프로젝트 메뉴"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectCardMenuId((cur) => (cur === project.id ? null : project.id));
                      }}
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
                        cursor: "pointer",
                      }}
                    >
                      <ProjectCardSettingsIcon />
                    </button>
                    {menuOpen ? (
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
                              : projectCardMenuLoading
                                ? "불러오는 중…"
                                : projectCardMenuReadiness?.gitLabel ?? (projectCardMenuError ? "확인 불가" : "—")}
                          </dd>
                          <dt style={{ fontWeight: 700, color: "#94a3b8" }}>GitHub 인증</dt>
                          <dd style={{ margin: 0 }}>
                            {project.status === PROJECT_LIFECYCLE_DELETED
                              ? "—"
                              : projectCardMenuLoading
                                ? "불러오는 중…"
                                : projectCardMenuReadiness?.githubLabel ?? (projectCardMenuError ? "확인 불가" : "—")}
                          </dd>
                          <dt style={{ fontWeight: 700, color: "#94a3b8" }}>Cursor 연결</dt>
                          <dd style={{ margin: 0 }}>
                            {project.status === PROJECT_LIFECYCLE_DELETED
                              ? "—"
                              : projectCardMenuLoading
                                ? "불러오는 중…"
                                : projectCardMenuReadiness?.cursorLabel ?? (projectCardMenuError ? "확인 불가" : "—")}
                          </dd>
                          <dt style={{ fontWeight: 700, color: "#94a3b8" }}>실행 가능</dt>
                          <dd style={{ margin: 0, fontWeight: 800 }}>
                            {project.status === PROJECT_LIFECYCLE_DELETED ? (
                              "—"
                            ) : projectCardMenuLoading ? (
                              "불러오는 중…"
                            ) : projectCardMenuReadiness ? (
                              <span style={{ color: projectCardMenuReadiness.runnable ? "#15803d" : "#b45309" }}>
                                {projectCardMenuReadiness.runnable ? "가능" : "불가"}
                              </span>
                            ) : projectCardMenuError ? (
                              <span style={{ color: "#b45309" }}>확인 불가</span>
                            ) : (
                              "—"
                            )}
                          </dd>
                        </dl>
                        {projectCardMenuError && project.status !== PROJECT_LIFECYCLE_DELETED ? (
                          <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#b91c1c", lineHeight: 1.35 }}>{projectCardMenuError}</p>
                        ) : null}
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                          <Link
                            href={`/projects/${encodeURIComponent(project.id)}`}
                            onClick={() => setProjectCardMenuId(null)}
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
                              boxSizing: "border-box",
                            }}
                          >
                            설정으로 이동
                          </Link>
                          <button
                            type="button"
                            onClick={() => openEditDescription(project)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "100%",
                              marginTop: 8,
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              background: "#fff",
                              color: "#0f172a",
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: "pointer",
                              boxSizing: "border-box",
                            }}
                          >
                            프로젝트 설명 수정
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  </div>
                </div>

                <div className="relative" style={{ color: "#555", marginBottom: 8 }}>
                  <ScreenLabel label="워크스페이스-프로젝트목록-프로젝트카드-설명" visible={showScreenLabels} />
                  {(() => {
                    const state = parseRequirementsStateJson(project.requirementsStateJson);
                    const original = typeof state.originalProjectDescription === "string" ? state.originalProjectDescription.trim() : "";
                    return original || "설명 없음";
                  })()}
                </div>
              </div>
              );
            })}
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

      {editDescTarget ? (
        <div
          role="dialog"
          aria-label="프로젝트 설명 수정"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(15, 23, 42, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onMouseDown={() => {
            if (!editDescBusy) setEditDescTarget(null);
          }}
        >
          <div
            style={{
              width: "min(92vw, 560px)",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 18px 60px -12px rgba(15, 23, 42, 0.35)",
              padding: 16,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>프로젝트 설명 수정</div>
            <div style={{ marginTop: 10 }}>
              <textarea
                value={editDescValue}
                onChange={(e) => setEditDescValue(e.target.value)}
                placeholder="설명을 입력해 주세요 (비워두면 '설명 없음')"
                rows={6}
                style={{
                  width: "100%",
                  resize: "vertical",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  lineHeight: 1.45,
                  outline: "none",
                }}
              />
              {editDescError ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c", fontWeight: 800 }}>{editDescError}</div>
              ) : null}
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                disabled={editDescBusy}
                onClick={() => setEditDescTarget(null)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#0f172a",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: editDescBusy ? "not-allowed" : "pointer",
                  opacity: editDescBusy ? 0.6 : 1,
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={editDescBusy}
                onClick={() => void saveEditDescription()}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #0f766e",
                  background: "#0f766e",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: editDescBusy ? "not-allowed" : "pointer",
                  opacity: editDescBusy ? 0.7 : 1,
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}