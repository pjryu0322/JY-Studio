import type { TaskDraftWorkflowExecutionProps } from "@/components/project-spec/TaskDraftPanel";
import type { Project } from "@/components/project-spec/types";

export type ProjectSpecWorkspaceProps = {
  projectId: string;
  project: Project | null;
  canEdit: boolean;
  onProjectUpdated: (next: Project) => void;
  workflowExecution: TaskDraftWorkflowExecutionProps;
  /** Task 초안 생성·확정 성공 후 상세 페이지 Task/TaskRun 목록 갱신 */
  onAfterTaskDraftsGenerate?: () => void | Promise<void>;
};
