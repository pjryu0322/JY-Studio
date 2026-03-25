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
  const [projectType, setProjectType] = useState("web-service");
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");

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
          projectType,
          repoUrl: repoUrl.trim(),
          defaultBranch: defaultBranch.trim(),
        }),
      });

      const json = (await res.json()) as ApiResponse<Project | null>;

      if (!res.ok || !json.success) {
        setErrorMessage(json.message || "프로젝트 생성에 실패했습니다.");
        return;
      }

      setName("");
      setDescription("");
      setProjectType("web-service");
      setRepoUrl("");
      setDefaultBranch("main");
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
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <section data-debug-label="[A] Header" style={{ marginBottom: 24 }}>
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
        data-debug-label="[B] Project Form"
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
              data-debug-label="[B-1] Project Name"
              style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
            />

            <textarea
              placeholder="프로젝트 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={4}
              data-debug-label="[B-2] Project Description"
              style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
            />

            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              disabled={submitting}
              data-debug-label="[B-3] Project Type"
              style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
            >
              <option value="web-service">web-service</option>
              <option value="api-service">api-service</option>
              <option value="si-enterprise">si-enterprise</option>
              <option value="rag-ai-service">rag-ai-service</option>
            </select>

            <input
              type="text"
              placeholder="저장소 URL (선택)"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={submitting}
              data-debug-label="[B-4] Repository URL"
              style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
            />

            <input
              type="text"
              placeholder="기본 브랜치"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              disabled={submitting}
              data-debug-label="[B-5] Branch"
              style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
            />

            <button
              type="submit"
              disabled={submitting}
              data-testid="home-create-project"
              data-debug-label="[B-6] Create Project"
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
        data-debug-label="[C] Project List"
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 16 }}>
          프로젝트 목록
        </h2>

        <div data-debug-label="[C-1] Project List Content">
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

                <div style={{ fontSize: 14, color: "#777" }}>
                  유형: {project.projectType} / 브랜치:{" "}
                  {project.defaultBranch || "-"}
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