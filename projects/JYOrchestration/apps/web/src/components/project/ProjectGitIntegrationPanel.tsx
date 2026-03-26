"use client";

import { useState } from "react";
import type { Project } from "@/components/project-spec/types";

type Props = {
  project: Project | null;
};

export function ProjectGitIntegrationPanel({ project }: Props) {
  const [note, setNote] = useState<string | null>(null);

  return (
    <section
      data-testid="project-git-integration-panel"
      data-ui-label="[P-6-4] Git Tab Surface — Repo Connect"
      style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20, marginBottom: 16 }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>Git 연동</h2>
      <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
        저장소를 연결하면 변경 반영·PR 등 Git 워크플로를 사용할 수 있습니다.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <div>
          <strong style={{ fontSize: 13 }}>연결 상태</strong>
          <div style={{ marginTop: 6, fontSize: 14, color: project?.repoUrl ? "#0f172a" : "#64748b" }}>
            {project?.repoUrl ? (
              <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
                {project.repoUrl}
              </a>
            ) : (
              "연결 안됨"
            )}
          </div>
        </div>
        {!project?.repoUrl ? (
          <button
            type="button"
            data-testid="project-git-connect-tab"
            onClick={() =>
              setNote("Git 연결 기능은 준비 중입니다. 준비되면 이 화면에서 바로 연결할 수 있습니다.")
            }
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
            Git 연결하기
          </button>
        ) : null}
      </div>
      {note ? <p style={{ marginTop: 12, fontSize: 13, color: "#475569" }}>{note}</p> : null}
    </section>
  );
}
