"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchExecutionSetup } from "@/components/project-spec/api";
import { ExecutionSetupPanel } from "@/components/project-spec/ExecutionSetupPanel";
import { formatTestedAt } from "@/components/project-spec/format";
import type { Project } from "@/components/project-spec/types";

type Props = {
  projectId: string;
  project: Project | null;
  canEdit: boolean;
};

export function ProjectGitIntegrationPanel({ projectId, project, canEdit }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const [executionSetup, setExecutionSetup] = useState<
    Awaited<ReturnType<typeof fetchExecutionSetup>>["json"]["data"] | null
  >(null);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const loadExecutionSetup = useCallback(async () => {
    if (!projectId.trim()) return;
    try {
      const { res, json } = await fetchExecutionSetup(projectId);
      if (res.ok && json.success) {
        const row = json.data;
        setExecutionSetup(
          row
            ? {
                ...row,
                allowedPathGlobs: row.allowedPathGlobs ?? [],
              }
            : null
        );
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  useEffect(() => {
    void loadExecutionSetup();
  }, [loadExecutionSetup]);

  const specWorkflowConfirmed = useMemo(
    () => Boolean(project?.currentSpecVersionId || project?.confirmedSpecAt),
    [project?.currentSpecVersionId, project?.confirmedSpecAt]
  );

  if (!projectId.trim()) return null;

  return (
    <div data-ui-label="[P-6-4] Git Tab — 연동 · 실행 환경">
      <section
        data-testid="project-git-integration-panel"
        data-ui-label="[P-6-4a] Git Tab — 프로젝트 저장소 요약"
        style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20, marginBottom: 16 }}
      >
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>Git 연동</h2>
        <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          프로젝트에 등록된 저장소 URL입니다. Cursor 원격 실행용 저장소·브랜치·정책은 아래「실행 환경 · Git 저장소」에서
          설정합니다.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <div>
            <strong style={{ fontSize: 13 }}>프로젝트 저장소</strong>
            <div style={{ marginTop: 6, fontSize: 14, color: project?.repoUrl ? "#0f172a" : "#64748b" }}>
              {project?.repoUrl ? (
                <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
                  {project.repoUrl}
                </a>
              ) : (
                "등록된 저장소 없음"
              )}
            </div>
          </div>
          {!project?.repoUrl ? (
            <button
              type="button"
              data-testid="project-git-connect-tab"
              onClick={() => setNote("프로젝트 개요 등에서 저장소를 연결할 수 있습니다. 연결 마법사는 준비 중입니다.")}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              저장소 연결 안내
            </button>
          ) : null}
        </div>
        {note ? <p style={{ marginTop: 12, fontSize: 13, color: "#475569" }}>{note}</p> : null}
      </section>

      <ExecutionSetupPanel
        projectId={projectId}
        canEdit={canEdit}
        specWorkflowConfirmed={specWorkflowConfirmed}
        executionSetup={executionSetup}
        setExecutionSetup={setExecutionSetup}
        setMessage={setExecutionMessage}
        formatTestedAt={formatTestedAt}
      />

      {executionMessage ? (
        <p style={{ marginTop: 14, marginBottom: 0, fontSize: 13, color: "#334155" }} role="status">
          {executionMessage}
        </p>
      ) : null}
    </div>
  );
}
