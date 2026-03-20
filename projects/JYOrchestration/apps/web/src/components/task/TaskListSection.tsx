import { TaskItem } from "@/components/project-spec/types";

export type TaskPromptItem = {
  taskId: string;
  projectId: string;
  promptText: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type TaskListSectionProps = {
  tasks: TaskItem[];
  loadingTasks: boolean;
  generatingPromptTaskId: string | null;
  taskPromptMap: Record<string, TaskPromptItem>;
  onGeneratePrompt: (taskId: string) => void;
};

export function TaskListSection({
  tasks,
  loadingTasks,
  generatingPromptTaskId,
  taskPromptMap,
  onGeneratePrompt,
}: TaskListSectionProps) {
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
              <p style={{ margin: "4px 0 0 0" }}>
                <strong>prompt:</strong> {taskPromptMap[task.id] ? "생성됨" : "미생성"}
              </p>
              <button
                type="button"
                onClick={() => onGeneratePrompt(task.id)}
                disabled={generatingPromptTaskId === task.id}
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: generatingPromptTaskId === task.id ? "not-allowed" : "pointer",
                  opacity: generatingPromptTaskId === task.id ? 0.7 : 1,
                }}
              >
                {generatingPromptTaskId === task.id ? "프롬프트 생성 중..." : "프롬프트 생성"}
              </button>
              {taskPromptMap[task.id] ? (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer" }}>프롬프트 미리보기</summary>
                  <pre
                    style={{
                      marginTop: 8,
                      background: "#f7f7f7",
                      border: "1px solid #e0e0e0",
                      borderRadius: 8,
                      padding: 10,
                      whiteSpace: "pre-wrap",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {taskPromptMap[task.id].promptText}
                  </pre>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
