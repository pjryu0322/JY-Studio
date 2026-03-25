"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Project = {
  id: string;
  name: string;
  description: string | null;
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
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [listMessage, setListMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [gitHintOnHome, setGitHintOnHome] = useState<string | null>(null);

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

  async function loadProjects() {
    try {
      setLoading(true);
      setListMessage(null);
      const res = await fetch("/api/projects", { credentials: "include" });
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
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMessage(null);
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

      if (!res.ok || !json.success) {
        setErrorMessage(json.message || "프로젝트 생성에 실패했습니다.");
        return;
      }

      setName("");
      setDescription("");
      setGitHintOnHome(null);
      setSuccessMessage(json.message || "프로젝트가 생성되었습니다.");

      await loadProjects();
    } catch (error) {
      console.error("Failed to create project:", error);
      setErrorMessage("프로젝트 생성 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void loadSession();
    void loadProjects();
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  }

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }} data-ui-label="[A] Home">
      <section data-ui-label="[A-1] Header" style={{ marginBottom: 24 }}>
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
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>
            JYOrchestration
          </h1>
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
          프로젝트 생성, ProjectSpec 등록, FeatureSpec 업로드, Task 계획과 실행을
          관리하는 웹서비스 MVP
        </p>
      </section>

      <section
        data-ui-label="[B] Create Project Form"
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
          새 프로젝트 생성
        </h2>

        <form onSubmit={handleCreateProject}>
          <div style={{ display: "grid", gap: 12 }}>
            {errorMessage ? (
              <p style={{ color: "#b00020", margin: 0 }}>{errorMessage}</p>
            ) : null}
            {successMessage ? (
              <p style={{ color: "#0b6b2a", margin: 0 }}>{successMessage}</p>
            ) : null}

            <input
              type="text"
              placeholder="프로젝트명"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              data-testid="home-project-name"
              data-ui-label="[B-1] Project Name"
              style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
            />

            <textarea
              placeholder="프로젝트 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={3}
              data-ui-label="[B-2] Project Description"
              style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
            />

            <button
              type="button"
              data-testid="home-advanced-settings-toggle"
              data-ui-label="[B-ADV] Advanced Settings Toggle"
              onClick={() => {
                setAdvancedOpen((v) => !v);
                setGitHintOnHome(null);
              }}
              disabled={submitting}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: "#fafafa",
                cursor: submitting ? "not-allowed" : "pointer",
                fontSize: 14,
                textAlign: "left",
                color: "#333",
              }}
            >
              {advancedOpen ? "▼ 고급 설정 닫기" : "▶ 고급 설정"}
            </button>

            {advancedOpen ? (
              <div
                data-ui-label="[B-ADV-PANEL] Advanced Settings"
                style={{
                  display: "grid",
                  gap: 14,
                  padding: 14,
                  borderRadius: 8,
                  border: "1px solid #e5e5e5",
                  background: "#fcfcfc",
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    프로젝트 유형
                  </label>
                  <select
                    value={defaultProjectType}
                    disabled
                    data-ui-label="[B-3] Project Type"
                    style={{
                      padding: 10,
                      border: "1px solid #ccc",
                      borderRadius: 8,
                      width: "100%",
                      maxWidth: 360,
                      opacity: 0.85,
                    }}
                  >
                    <option value="web-service">web-service</option>
                  </select>
                  <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#64748b" }}>
                    현재는 web-service만 지원됩니다
                  </p>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    저장소 (Git)
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, color: "#64748b" }}>연결 안됨</span>
                    <button
                      type="button"
                      data-testid="home-git-connect-hint"
                      onClick={() =>
                        setGitHintOnHome("프로젝트를 만든 뒤 상세 화면에서 Git을 연결할 수 있습니다.")
                      }
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        background: "#fff",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Git 연결하기
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    기본 브랜치
                  </label>
                  <input
                    type="text"
                    value={defaultBranch}
                    readOnly
                    data-ui-label="[B-5] Default Branch"
                    aria-readonly
                    style={{
                      padding: 10,
                      border: "1px solid #ccc",
                      borderRadius: 8,
                      width: "100%",
                      maxWidth: 360,
                      background: "#f1f5f9",
                      color: "#334155",
                    }}
                  />
                </div>
              </div>
            ) : null}

            {gitHintOnHome ? (
              <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{gitHintOnHome}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              data-testid="home-create-project"
              data-ui-label="[B-6] Create Project Submit"
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                border: "none",
                background: "#111",
                color: "#fff",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "생성 중..." : "프로젝트 생성"}
            </button>
          </div>
        </form>
      </section>

      <section
        data-ui-label="[C] Project List"
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
          프로젝트 목록
        </h2>

        <div data-ui-label="[C-1] Project List Content">
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
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <strong>{project.name}</strong>
                  <span>{project.status}</span>
                </div>

                <div style={{ color: "#555", marginBottom: 8 }}>
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
                <div style={{ marginTop: 12 }}>
                  <Link
                    href={`/projects/${project.id}`}
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
                    상세 보기
                  </Link>
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
    </main>
  );
}