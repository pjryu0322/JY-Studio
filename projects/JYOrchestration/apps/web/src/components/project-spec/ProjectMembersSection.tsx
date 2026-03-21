import type { ProjectMemberRow } from "@/lib/rbac/mockProjectContext";

type ProjectMembersSectionProps = {
  members: ProjectMemberRow[];
};

export function ProjectMembersSection({ members }: ProjectMembersSectionProps) {
  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>프로젝트 멤버 / 권한</h2>
      <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
        멤버 초대·역할 변경은 다음 단계에서 API로 연결할 수 있습니다. 현재는 mock 목록입니다.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {members.map((m) => (
          <li
            key={m.userId}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              borderBottom: "1px solid #eee",
              paddingBottom: 8,
            }}
          >
            <span>
              <strong>userId:</strong> {m.userId}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid #ccc",
                background: "#f7f7f7",
              }}
            >
              {m.role}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
