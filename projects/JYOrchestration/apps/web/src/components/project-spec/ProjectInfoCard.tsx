import { Project } from "./types";

type ProjectInfoCardProps = {
  project: Project | null;
  currentUserRoleLabel: string | null;
};

export function ProjectInfoCard({ project, currentUserRoleLabel }: ProjectInfoCardProps) {
  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>프로젝트 기본 정보</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {currentUserRoleLabel ? (
          <div>
            <strong>현재 역할:</strong> {currentUserRoleLabel}
          </div>
        ) : null}
        <div>
          <strong>프로젝트명:</strong> {project?.name || "정보 없음"}
        </div>
        <div>
          <strong>설명:</strong> {project?.description || "설명 없음"}
        </div>
        <div>
          <strong>Project Type:</strong> {project?.projectType || "-"}
        </div>
        <div>
          <strong>Status:</strong> {project?.status || "-"}
        </div>
      </div>
    </section>
  );
}
