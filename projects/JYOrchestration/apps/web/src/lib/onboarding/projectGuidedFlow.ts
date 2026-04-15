import type { TaskItem, UploadHistoryItem } from "@/components/project-spec/types";
import type {
  GitChangeRequestItem,
  TaskPromptItem,
  TaskRunItem,
} from "@/components/task/TaskListSection";

export const GUIDED_FLOW_STEP_IDS = [1, 2, 3, 4, 5, 6, 7] as const;
export type GuidedFlowStepId = (typeof GUIDED_FLOW_STEP_IDS)[number];

export const GUIDED_FLOW_ANCHORS = {
  /** 워크스페이스 기반 Spec 정의(메인 흐름) */
  upload: "guided-flow-spec-workspace",
  history: "guided-flow-spec-workspace",
  tasks: "guided-flow-tasks",
  git: "guided-flow-git",
} as const;

export type GuidedFlowStepView = {
  id: GuidedFlowStepId;
  title: string;
  shortTitle: string;
  done: boolean;
  /** 화면 내 섹션으로 스크롤 (해시 없이 id만) */
  anchorId?: string;
};

export type ProjectGuidedFlowSnapshot = {
  steps: GuidedFlowStepView[];
  currentStepId: GuidedFlowStepId;
  allComplete: boolean;
};

function hasParsedSpec(uploadHistory: UploadHistoryItem[]): boolean {
  return uploadHistory.some((u) => u.hasParsedJson === true);
}

function hasRunReadyForGitOrDone(taskRuns: TaskRunItem[]): boolean {
  return taskRuns.some(
    (r) => r.status === "READY_FOR_GIT" || r.status === "DONE"
  );
}

function hasGitApplyCompleted(gitRequests: GitChangeRequestItem[]): boolean {
  return gitRequests.some((g) => g.applyStatus === "DONE");
}

/**
 * 프로젝트 상세 화면 기준(STEP 1은 항상 완료로 간주).
 * 실행 로직·API와 무관한 순수 UI 힌트용 상태 계산.
 */
export function computeProjectGuidedFlowSnapshot(input: {
  uploadHistory: UploadHistoryItem[];
  tasks: TaskItem[];
  taskPrompts: TaskPromptItem[];
  taskRuns: TaskRunItem[];
  gitRequests: GitChangeRequestItem[];
}): ProjectGuidedFlowSnapshot {
  const s1 = true;
  const s2 = input.uploadHistory.length > 0;
  const s3 = hasParsedSpec(input.uploadHistory);
  const s4 = input.tasks.length > 0;
  const s5 = input.taskPrompts.length > 0;
  const s6 = hasRunReadyForGitOrDone(input.taskRuns);
  const s7 = hasGitApplyCompleted(input.gitRequests);

  const steps: GuidedFlowStepView[] = [
    {
      id: 1,
      title: "STEP 1: Project 생성",
      shortTitle: "Project",
      done: s1,
    },
    {
      id: 2,
      title: "STEP 2: 실행 계획 등록",
      shortTitle: "실행 계획 등록",
      done: s2,
      anchorId: GUIDED_FLOW_ANCHORS.upload,
    },
    {
      id: 3,
      title: "STEP 3: AI 분석",
      shortTitle: "AI 분석",
      done: s3,
      anchorId: GUIDED_FLOW_ANCHORS.history,
    },
    {
      id: 4,
      title: "STEP 4: AI 작업 생성",
      shortTitle: "AI 작업 생성",
      done: s4,
      anchorId: GUIDED_FLOW_ANCHORS.history,
    },
    {
      id: 5,
      title: "STEP 5: Prompt 생성",
      shortTitle: "Prompt",
      done: s5,
      anchorId: GUIDED_FLOW_ANCHORS.tasks,
    },
    {
      id: 6,
      title: "STEP 6: Run 실행",
      shortTitle: "Run",
      done: s6,
      anchorId: GUIDED_FLOW_ANCHORS.tasks,
    },
    {
      id: 7,
      title: "STEP 7: Git 반영",
      shortTitle: "Git 반영",
      done: s7,
      anchorId: GUIDED_FLOW_ANCHORS.git,
    },
  ];

  const firstOpen = steps.find((x) => !x.done);
  const currentStepId: GuidedFlowStepId = firstOpen
    ? firstOpen.id
    : 7;
  const allComplete = steps.every((x) => x.done);

  return { steps, currentStepId, allComplete };
}

export function guidedFlowNextHint(input: {
  currentStepId: GuidedFlowStepId;
  canRegisterSpec: boolean;
  canReview: boolean;
  canOperate: boolean;
}): string {
  switch (input.currentStepId) {
    case 1:
      return "이미 프로젝트가 열려 있습니다. 아래 단계로 진행하세요.";
    case 2:
      if (!input.canRegisterSpec) {
        return "Spec 워크스페이스 편집은 PLANNER·OWNER 권한이 필요합니다. 담당자에게 요청하거나 역할을 확인하세요.";
      }
      return "워크스페이스에서 실행 계획을 작성·저장한 뒤 AI 실행 계획 문서를 생성하세요.";
    case 3:
      if (!input.canReview) {
        return "AI 분석은 REVIEWER 이상에서 실행할 수 있습니다.";
      }
      return "AI 분석이 자동으로 진행됩니다. 잠시만 기다리세요.";
    case 4:
      if (!input.canReview) {
        return "AI 작업 생성은 REVIEWER 이상에서 실행할 수 있습니다.";
      }
      return "AI 작업 생성이 완료되면 아래에서 Task를 확인하세요.";
    case 5:
      if (!input.canReview) {
        return "프롬프트 생성은 REVIEWER 이상에서 실행할 수 있습니다.";
      }
      return "Task 목록에서 각 Task의 프롬프트 생성을 진행하세요.";
    case 6:
      if (!input.canOperate) {
        return "Run 실행은 OPERATOR 이상에서 가능합니다.";
      }
      return "Task 목록에서 Run을 실행하고, 필요 시 Git 반영 준비로 전환하세요.";
    case 7:
      if (!input.canOperate) {
        return "Git 반영은 OPERATOR 이상에서 진행할 수 있습니다.";
      }
      return "Git 반영 요청을 등록한 뒤, 정책에 따라 승인·반영을 완료하세요.";
    default:
      return "";
  }
}
