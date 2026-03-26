"use client";

import type { Project } from "@/components/project-spec/types";

type Props = {
  project: Project | null;
};

export function ProjectAdvancedSettingsPanel({ project }: Props) {
  const branch = project?.defaultBranch?.trim() || "main";

  return (
    <section
      data-testid="project-advanced-settings-panel"
      data-ui-label="[P-6-5] Advanced Surface — Static Project Options"
      style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20, marginBottom: 16 }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>고급 설정</h2>
      <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
        프로젝트 생성 시 적용된 기술 옵션입니다. 유형은 현재 고정이며, 저장소는 Git 연동 탭에서 관리합니다.
      </p>

      <div style={{ display: "grid", gap: 16, maxWidth: 480 }}>
        <div>
          <label
            htmlFor="project-adv-project-type"
            style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
          >
            Project Type
          </label>
          <select
            id="project-adv-project-type"
            value={project?.projectType ?? "web-service"}
            disabled
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 8,
              width: "100%",
              opacity: 0.9,
            }}
          >
            <option value="web-service">web-service</option>
          </select>
          <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "#64748b" }}>현재는 web-service만 지원됩니다</p>
        </div>

        <div>
          <label
            htmlFor="project-adv-repo-url"
            style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
          >
            Repository URL
          </label>
          <input
            id="project-adv-repo-url"
            type="text"
            readOnly
            value={project?.repoUrl ?? ""}
            placeholder="연결 안됨"
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 8,
              width: "100%",
              background: "#f8fafc",
              color: "#334155",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="project-adv-default-branch"
            style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}
          >
            Default Branch
          </label>
          <input
            id="project-adv-default-branch"
            type="text"
            readOnly
            value={branch}
            style={{
              padding: 10,
              border: "1px solid #ccc",
              borderRadius: 8,
              width: "100%",
              background: "#f1f5f9",
              color: "#334155",
            }}
          />
        </div>
      </div>
    </section>
  );
}
