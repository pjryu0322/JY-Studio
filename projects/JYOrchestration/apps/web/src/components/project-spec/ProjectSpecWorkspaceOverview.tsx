"use client";

import type { SpecWorkspaceSnapshot } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";
import { WorkspaceSectionHeader } from "@/components/project-spec/WorkspaceSectionHeader";
import { WorkspaceFetchStatus } from "@/components/workspace/WorkspaceFetchStatus";

export type ProjectSpecWorkspaceOverviewProps = {
  readonly projectInfoOpen: boolean;
  readonly onToggleProjectInfo: () => void;
  readonly workspace: SpecWorkspaceSnapshot | null;
  readonly project: Project | null;
  readonly loadError: string | null;
  readonly loadingWs: boolean;
};

export function ProjectSpecWorkspaceOverview({
  projectInfoOpen,
  onToggleProjectInfo,
  workspace,
  project,
  loadError,
  loadingWs,
}: ProjectSpecWorkspaceOverviewProps) {
  return (
    <>
      <WorkspaceSectionHeader section="workspaceRoot" as="h2" marginBottom={8} />
      <p style={{ margin: "0 0 16px 0", color: "#475569", lineHeight: 1.55, fontSize: 14 }}>
        프로젝트 기본 정보 → AI 실행 계획 초안 후보 비교 → 작업 문서 편집·저장 → <strong>AI 생성 설정</strong> →{" "}
        <strong>AI 실행 계획 문서 생성</strong> → 응답 비교·확정 → 아래 Task 초안 확인·확정 순으로 진행합니다. 실행 계획 본문은
        서버가 주입하고, 템플릿·프리셋은 생성 전에 설정합니다.
      </p>
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          data-testid="spec-workspace-project-info-toggle"
          onClick={onToggleProjectInfo}
          style={{
            padding: "7px 12px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            background: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            color: "#334155",
          }}
        >
          {projectInfoOpen ? "프로젝트 정보 닫기" : "프로젝트 정보 보기"}
        </button>
        {projectInfoOpen ? (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              fontSize: 12,
              color: "#334155",
              lineHeight: 1.55,
            }}
          >
            <div>
              <strong>이름:</strong> {workspace?.project.name ?? project?.name ?? "-"}
            </div>
            <div>
              <strong>설명:</strong> {(workspace?.project.description ?? project?.description ?? "-") || "-"}
            </div>
            <div>
              <strong>유형:</strong> {workspace?.project.projectType ?? project?.projectType ?? "-"}
            </div>
            <div>
              <strong>상태:</strong> {project?.status ?? "-"}
            </div>
          </div>
        ) : null}
      </div>

      <WorkspaceFetchStatus loadError={loadError} loadingWithoutData={loadingWs && !workspace} />
    </>
  );
}
