"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchExecutionSetup, fetchProjectById, type ExecutionSetupDto } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";
import type { ProjectMemberUiRow } from "@/components/project-spec/memberUiTypes";
import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
import { ProjectExecutionReadinessSummary } from "@/components/project/ProjectExecutionReadinessSummary";
import { projectExecutionSettingsHref } from "@/lib/project/projectExecutionSettingsHref";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = typeof params?.projectId === "string" ? params.projectId : "";

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [memberRows, setMemberRows] = useState<ProjectMemberUiRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [executionSetupOverview, setExecutionSetupOverview] = useState<ExecutionSetupDto | null>(null);
  const [executionSetupOverviewLoading, setExecutionSetupOverviewLoading] = useState(false);

  const encodedProjectId = useMemo(() => encodeURIComponent(projectId), [projectId]);

  const loadProject = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchProjectById(pid);
      setProject(result.project);
      setErrorMessage(result.errorMessage);
    } catch (e) {
      setProject(null);
      setErrorMessage(e instanceof Error ? e.message : "프로젝트 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadMembersSummary = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/project/session-context?projectId=${encodeURIComponent(pid)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as { success?: boolean; data?: { members: ProjectMemberUiRow[] } };
      if (!res.ok || !json.success || !json.data) {
        setMemberRows([]);
        return;
      }
      setMemberRows(Array.isArray(json.data.members) ? json.data.members : []);
    } catch {
      setMemberRows([]);
    } finally {
      setMembersLoading(false);
    }
  }, [projectId]);

  const loadExecutionReadinessSummary = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    setExecutionSetupOverviewLoading(true);
    try {
      const { res, json } = await fetchExecutionSetup(pid);
      if (!res.ok || !json.success) {
        setExecutionSetupOverview(null);
        return;
      }
      setExecutionSetupOverview(json.data ?? null);
    } catch {
      setExecutionSetupOverview(null);
    } finally {
      setExecutionSetupOverviewLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    void loadMembersSummary();
  }, [loadMembersSummary]);

  useEffect(() => {
    void loadExecutionReadinessSummary();
  }, [loadExecutionReadinessSummary]);

  const projectName = (project?.name ?? "").trim() || "프로젝트";
  const projectDescription = (project?.description ?? "").trim();

  const memberCount = memberRows.length;
  const hasAnyAi = memberRows.some((m) => m.memberType === "AI");

  const membersHref = `/project-admin/members?projectId=${encodedProjectId}`;
  const settingsHref = projectExecutionSettingsHref(projectId, { from: "planning" });

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }} data-testid="project-hub-page">
      <header style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/" style={{ color: "#334155", textDecoration: "none", fontWeight: 700 }}>
            ← 플랫폼 홈(프로젝트 목록)
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#0f172a" }}>{projectName}</h1>
        </div>
        {projectDescription ? (
          <p style={{ margin: "8px 0 0 0", fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            {projectDescription}
          </p>
        ) : null}
      </header>

      <div style={{ marginTop: 12, marginBottom: 18 }}>
        <ProjectWorkflowNav />
      </div>

      {loading ? (
        <div style={{ padding: 14, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff" }}>
          불러오는 중...
        </div>
      ) : errorMessage ? (
        <div style={{ padding: 14, borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b" }}>
          {errorMessage}
        </div>
      ) : null}

      <section
        aria-label="프로젝트 요약"
        style={{
          marginBottom: 18,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#ffffff",
        }}
      >
        <h2 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>요약</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
          상단 워크플로로 이동하고, 아래 카드에서 관리 기능을 빠르게 실행할 수 있습니다.
        </p>
      </section>

      <ProjectExecutionReadinessSummary
        setup={executionSetupOverview}
        loading={executionSetupOverviewLoading}
        settingsHref={settingsHref}
      />

      <section
        aria-label="멤버 요약"
        style={{
          marginBottom: 18,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>멤버</h2>
          <Link
            href={membersHref}
            style={{
              marginLeft: "auto",
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#0f172a",
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            멤버 관리로 이동
          </Link>
        </div>
        <dl
          style={{
            margin: 0,
            display: "grid",
            gap: 8,
            fontSize: 13,
            color: "#334155",
            gridTemplateColumns: "minmax(140px,auto) 1fr",
          }}
        >
          <dt style={{ fontWeight: 700, color: "#64748b" }}>멤버 수</dt>
          <dd style={{ margin: 0 }}>{membersLoading ? "불러오는 중…" : `${memberCount}명`}</dd>
          <dt style={{ fontWeight: 700, color: "#64748b" }}>AI 멤버</dt>
          <dd style={{ margin: 0 }}>{membersLoading ? "불러오는 중…" : hasAnyAi ? "포함" : "없음"}</dd>
        </dl>
      </section>

      <section
        aria-label="관리 바로가기"
        style={{
          marginBottom: 18,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#ffffff",
        }}
      >
        <h2 style={{ margin: "0 0 10px 0", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>관리 바로가기</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href={`/projects/${encodedProjectId}?view=workspace`} style={quickLinkStyle()}>
            실행 준비
          </Link>
          <Link href={membersHref} style={quickLinkStyle()}>
            프로젝트 멤버
          </Link>
          <Link href={settingsHref} style={quickLinkStyle()}>
            설정
          </Link>
        </div>
      </section>
    </main>
  );
}

function quickLinkStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
  } as const;
}

