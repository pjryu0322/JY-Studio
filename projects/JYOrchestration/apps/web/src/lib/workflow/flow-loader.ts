import {
  fetchExecutionSetup,
  fetchGeneratedTasks,
  fetchProjectById,
} from "@/components/project-spec/api";
import type { ExecutionSetupDto } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";

export type AppFlowLoadedContext = {
  project: Project | null;
  taskCount: number;
  executionSetup: ExecutionSetupDto | null;
};

/** 워크플로 안내용 프로젝트·작업·실행 설정 스냅샷(클라이언트 전용 fetch) */
export async function loadAppFlowProjectContext(projectId: string): Promise<AppFlowLoadedContext> {
  const [{ project }, tasksRes, setupRes] = await Promise.all([
    fetchProjectById(projectId),
    fetchGeneratedTasks(projectId),
    fetchExecutionSetup(projectId),
  ]);
  let taskCount = 0;
  if (tasksRes.res.ok && tasksRes.json.success && Array.isArray(tasksRes.json.data)) {
    taskCount = tasksRes.json.data.length;
  }
  let executionSetup: ExecutionSetupDto | null = null;
  if (setupRes.res.ok && setupRes.json.success && setupRes.json.data) {
    executionSetup = setupRes.json.data;
  }
  return { project: project ?? null, taskCount, executionSetup };
}
