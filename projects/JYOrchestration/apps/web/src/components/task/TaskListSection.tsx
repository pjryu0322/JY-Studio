import { TaskItem } from "@/components/project-spec/types";

type TaskListSectionProps = {
  tasks: TaskItem[];
  loadingTasks: boolean;
};

export function TaskListSection({ tasks, loadingTasks }: TaskListSectionProps) {
  return (
    <section
      style={{
        borderTop: "1px solid #e5e5e5",
        marginTop: 16,
        paddingTop: 12,
      }}
    >
      <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px 0" }}>생성된 Task 목록</h3>
      <p style={{ margin: "0 0 8px 0", color: "#555" }}>
        현재 단계는 parsedJson 기반 mock 규칙으로 Task를 생성합니다.
      </p>
      {loadingTasks ? (
        <p style={{ margin: 0, color: "#555" }}>Task 목록을 불러오는 중...</p>
      ) : tasks.length === 0 ? (
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
