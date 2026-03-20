import { TaskItem } from "@/components/project-spec/types";

type TaskListSectionProps = {
  tasks: TaskItem[];
};

export function TaskListSection({ tasks }: TaskListSectionProps) {
  return (
    <section
      style={{
        borderTop: "1px solid #e5e5e5",
        marginTop: 16,
        paddingTop: 12,
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px 0" }}>생성된 Task 목록</h3>
      {tasks.length === 0 ? (
        <p style={{ margin: 0, color: "#555" }}>아직 생성된 Task가 없습니다.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                padding: 10,
                background: "#fff",
              }}
            >
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>name:</strong> {task.name}
              </p>
              <p style={{ margin: 0, marginBottom: 4 }}>
                <strong>status:</strong> {task.status}
              </p>
              <p style={{ margin: 0 }}>
                <strong>order:</strong> {task.order}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
