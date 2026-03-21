import { TaskItem } from "@/components/project-spec/types";
import { formatTestedAt } from "@/components/project-spec/format";

export type TaskPromptItem = {
  id: string;
  taskId: string;
  projectId: string;
  promptText: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskRunItem = {
  id: string;
  taskId: string;
  taskPromptId: string;
  status: string;
  resultText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GitChangeRequestFileItem = {
  path: string;
  type: "MODIFY" | "CREATE";
};

export type GitChangeRequestItem = {
  id: string;
  projectId: string;
  taskId: string;
  taskRunId: string;
  status: string;
  requestNote: string | null;
  files: GitChangeRequestFileItem[] | null;
  diffText: string | null;
  commitMessage: string | null;
  applyStatus: string | null;
  applyLog: string | null;
  branchName?: string | null;
  applyStartedAt?: string | null;
  applyFinishedAt?: string | null;
  retryCount?: number;
  lastError?: string | null;
  lastRetryAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaskListSectionProps = {
  tasks: TaskItem[];
  loadingTasks: boolean;
  loadingTaskPrompts: boolean;
  loadingTaskRuns: boolean;
  promptMessage: string | null;
  generatingPromptTaskId: string | null;
  taskPromptMap: Record<string, TaskPromptItem>;
  runningPromptId: string | null;
  markingReadyTaskId: string | null;
  registeringGitRequestRunId: string | null;
  taskRunMap: Record<string, TaskRunItem>;
  canGeneratePrompt: boolean;
  canRunTask: boolean;
  canMarkReadyForGit: boolean;
  canRegisterGitRequest: boolean;
  onGeneratePrompt: (taskId: string) => void;
  onRunTask: (taskId: string) => void;
  onMarkReadyForGit: (taskId: string) => void;
  onRegisterGitRequest: (taskId: string) => void;
};

export function TaskListSection({
  tasks,
  loadingTasks,
  loadingTaskPrompts,
  loadingTaskRuns,
  promptMessage,
  generatingPromptTaskId,
  taskPromptMap,
  runningPromptId,
  markingReadyTaskId,
  registeringGitRequestRunId,
  taskRunMap,
  canGeneratePrompt,
  canRunTask,
  canMarkReadyForGit,
  canRegisterGitRequest,
  onGeneratePrompt,
  onRunTask,
  onMarkReadyForGit,
  onRegisterGitRequest,
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
      {promptMessage ? <p style={{ margin: "0 0 8px 0", color: "#333" }}>{promptMessage}</p> : null}
      {loadingTaskPrompts ? (
        <p style={{ margin: "0 0 8px 0", color: "#555" }}>Task 프롬프트를 불러오는 중...</p>
      ) : null}
      {loadingTaskRuns ? <p style={{ margin: "0 0 8px 0", color: "#555" }}>Task 실행 이력을 불러오는 중...</p> : null}
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
              <p style={{ margin: "4px 0 0 0" }}>
                <strong>prompt version:</strong>{" "}
                {taskPromptMap[task.id] ? taskPromptMap[task.id].version : "-"}
              </p>
              <p style={{ margin: "4px 0 0 0" }}>
                <strong>prompt status:</strong> {taskPromptMap[task.id]?.status || "-"}
              </p>
              {canGeneratePrompt ? (
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
              ) : null}
              {canRunTask ? (
                <button
                  type="button"
                  onClick={() => onRunTask(task.id)}
                  disabled={!taskPromptMap[task.id] || runningPromptId === taskPromptMap[task.id]?.id}
                  style={{
                    marginTop: 8,
                    marginLeft: canGeneratePrompt ? 8 : 0,
                    padding: "6px 10px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    background: "#fff",
                    cursor:
                      !taskPromptMap[task.id] || runningPromptId === taskPromptMap[task.id]?.id
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      !taskPromptMap[task.id] || runningPromptId === taskPromptMap[task.id]?.id ? 0.7 : 1,
                  }}
                >
                  {runningPromptId === taskPromptMap[task.id]?.id ? "Run 실행 중..." : "Run 실행"}
                </button>
              ) : null}
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
              <p style={{ margin: "8px 0 0 0" }}>
                <strong>run status:</strong> {taskRunMap[task.id]?.status || "-"}
              </p>
              {taskRunMap[task.id]?.status === "READY_FOR_GIT" ? (
                <p style={{ margin: "4px 0 0 0", color: "#0a7d2e", fontWeight: 600 }}>
                  Git 반영 준비 완료
                </p>
              ) : null}
              <p style={{ margin: "4px 0 0 0" }}>
                <strong>resultText:</strong> {taskRunMap[task.id]?.resultText || "-"}
              </p>
              <p style={{ margin: "4px 0 0 0" }}>
                <strong>run createdAt:</strong>{" "}
                {taskRunMap[task.id]?.createdAt ? formatTestedAt(taskRunMap[task.id].createdAt) : "-"}
              </p>
              {canMarkReadyForGit && taskRunMap[task.id]?.status === "DONE" ? (
                <button
                  type="button"
                  onClick={() => onMarkReadyForGit(task.id)}
                  disabled={markingReadyTaskId === task.id}
                  style={{
                    marginTop: 8,
                    padding: "6px 10px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: markingReadyTaskId === task.id ? "not-allowed" : "pointer",
                    opacity: markingReadyTaskId === task.id ? 0.7 : 1,
                  }}
                >
                  {markingReadyTaskId === task.id ? "전환 중..." : "Git 반영 준비"}
                </button>
              ) : null}
              {canRegisterGitRequest && taskRunMap[task.id]?.status === "READY_FOR_GIT" ? (
                <button
                  type="button"
                  onClick={() => onRegisterGitRequest(task.id)}
                  disabled={registeringGitRequestRunId === taskRunMap[task.id]?.id}
                  style={{
                    marginTop: 8,
                    marginLeft: 8,
                    padding: "6px 10px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    background: "#fff",
                    cursor:
                      registeringGitRequestRunId === taskRunMap[task.id]?.id
                        ? "not-allowed"
                        : "pointer",
                    opacity: registeringGitRequestRunId === taskRunMap[task.id]?.id ? 0.7 : 1,
                  }}
                >
                  {registeringGitRequestRunId === taskRunMap[task.id]?.id
                    ? "요청 등록 중..."
                    : "Git 요청 등록"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
