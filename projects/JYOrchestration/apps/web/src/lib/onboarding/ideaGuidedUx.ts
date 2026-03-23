/**
 * 아이디어 기반 7단계 가이드 (순수 계산; API 무관).
 */

import type { TaskItem, UploadHistoryItem } from "@/components/project-spec/types";
import type {
  GitChangeRequestItem,
  TaskPromptItem,
  TaskRunItem,
} from "@/components/task/TaskListSection";

export const IDEA_UX_STEP_IDS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IdeaUxStepId = (typeof IDEA_UX_STEP_IDS)[number];

export const IDEA_UX_ANCHORS: Record<IdeaUxStepId, string> = {
  1: "guided-flow-upload",
  2: "guided-flow-history",
  3: "guided-flow-history",
  4: "guided-flow-tasks",
  5: "guided-flow-tasks",
  6: "guided-flow-git",
  7: "guided-flow-git",
};

export const IDEA_UX_STEP_LABELS: Record<
  IdeaUxStepId,
  { title: string; short: string }
> = {
  1: { title: "아이디어", short: "아이디어" },
  2: { title: "기능 정의", short: "기능 정의" },
  3: { title: "작업 생성", short: "작업" },
  4: { title: "실행", short: "실행" },
  5: { title: "코드 생성", short: "코드" },
  6: { title: "Git 반영", short: "Git" },
  7: { title: "PR 협업", short: "PR" },
};

export type IdeaUxActionId =
  | "scroll_upload"
  | "scroll_history"
  | "scroll_tasks"
  | "scroll_git"
  | "run_parse"
  | "generate_tasks"
  | "generate_prompt"
  | "run_task"
  | "mark_ready_for_git"
  | "register_git_request"
  | "apply_git"
  | "retry_git_apply"
  | "create_pr"
  | "sync_pr"
  | "none";

export type IdeaUxPrimaryAction = {
  id: IdeaUxActionId;
  label: string;
  description: string;
  /** run_parse, generate_tasks 등에 사용 */
  uploadId?: string;
  taskId?: string;
  gitChangeRequestId?: string;
};

export type IdeaUxAchievements = {
  taskRunReady: boolean;
  gitApplyDone: boolean;
  prLinked: boolean;
};

export type IdeaGuidedUxSnapshot = {
  currentStep: IdeaUxStepId;
  allComplete: boolean;
  steps: { id: IdeaUxStepId; done: boolean }[];
  primaryAction: IdeaUxPrimaryAction;
  achievements: IdeaUxAchievements;
  scrollAnchor: string;
};

function hasParsedSpec(uploadHistory: UploadHistoryItem[]): boolean {
  return uploadHistory.some((u) => u.hasParsedJson === true);
}

function hasGitApplyCompleted(gitRequests: GitChangeRequestItem[]): boolean {
  return gitRequests.some((g) => g.applyStatus === "DONE");
}

function applyLogHasGitPushOk(log: string | null | undefined): boolean {
  return Boolean(log && log.includes("[GIT] push OK"));
}

function needsPrCollaboration(gitRequests: GitChangeRequestItem[]): boolean {
  return gitRequests.some(
    (g) =>
      g.applyStatus === "DONE" &&
      applyLogHasGitPushOk(g.applyLog) &&
      g.pullRequestNumber == null
  );
}

function firstParsedUploadId(uploadHistory: UploadHistoryItem[]): string | null {
  const row = uploadHistory.find((u) => u.hasParsedJson);
  return row?.id ?? null;
}

function firstUnparsedUploadId(uploadHistory: UploadHistoryItem[]): string | null {
  const row = uploadHistory.find((u) => !u.hasParsedJson);
  return row?.id ?? null;
}

function firstTaskWithoutPrompt(
  tasks: TaskItem[],
  taskPromptMap: Record<string, TaskPromptItem | undefined>
): TaskItem | null {
  const t = tasks.find((x) => !taskPromptMap[x.id]);
  return t ?? null;
}

function firstReadyForGitRunWithoutGcr(
  taskRuns: TaskRunItem[],
  gitRequests: GitChangeRequestItem[]
): TaskRunItem | null {
  return (
    taskRuns.find(
      (r) =>
        r.status === "READY_FOR_GIT" &&
        !gitRequests.some((g) => g.taskRunId === r.id)
    ) ?? null
  );
}

function firstDoneRunNeedingReady(
  tasks: TaskItem[],
  taskRuns: TaskRunItem[]
): { taskId: string } | null {
  const done = taskRuns.find((r) => r.status === "DONE");
  if (!done) {
    return null;
  }
  const ready = taskRuns.find(
    (r) => r.taskId === done.taskId && r.status === "READY_FOR_GIT"
  );
  if (ready) {
    return null;
  }
  if (tasks.some((t) => t.id === done.taskId)) {
    return { taskId: done.taskId };
  }
  return null;
}

function firstTaskNeedingRun(
  tasks: TaskItem[],
  taskRunMap: Record<string, TaskRunItem | undefined>
): TaskItem | null {
  for (const t of tasks) {
    const r = taskRunMap[t.id];
    if (!r || r.status === "FAILED" || r.status === "PENDING") {
      return t;
    }
  }
  return null;
}

function firstFailedGitApplyId(gitRequests: GitChangeRequestItem[]): string | null {
  const row = gitRequests.find((g) => g.applyStatus === "FAILED");
  return row?.id ?? null;
}

function firstDoneGitNeedingPr(gitRequests: GitChangeRequestItem[]): GitChangeRequestItem | null {
  return (
    gitRequests.find(
      (g) =>
        g.applyStatus === "DONE" &&
        applyLogHasGitPushOk(g.applyLog) &&
        g.pullRequestNumber == null
    ) ?? null
  );
}

function firstGitNeedingApply(gitRequests: GitChangeRequestItem[]): GitChangeRequestItem | null {
  const manual = (g: GitChangeRequestItem) =>
    String(g.gitApprovalMode ?? "").includes("MANUAL");
  return (
    gitRequests.find((g) => {
      if (g.applyStatus === "FAILED") {
        return true;
      }
      if (g.applyStatus === "DONE" || g.applyStatus === "APPLYING") {
        return false;
      }
      if (manual(g) && g.status !== "APPROVED") {
        return false;
      }
      return true;
    }) ?? null
  );
}

/**
 * 현재 단계 (1–7) 및 권장 다음 행동.
 */
export function computeIdeaGuidedUxSnapshot(input: {
  uploadHistory: UploadHistoryItem[];
  tasks: TaskItem[];
  taskRuns: TaskRunItem[];
  gitRequests: GitChangeRequestItem[];
  taskPromptMap: Record<string, TaskPromptItem | undefined>;
  taskRunMap: Record<string, TaskRunItem | undefined>;
  canRegisterSpec: boolean;
  canReview: boolean;
  canOperate: boolean;
}): IdeaGuidedUxSnapshot {
  const { uploadHistory, tasks, taskRuns, gitRequests, taskPromptMap, taskRunMap } =
    input;

  const achievements: IdeaUxAchievements = {
    taskRunReady: taskRuns.some(
      (r) => r.status === "READY_FOR_GIT" || r.status === "DONE"
    ),
    gitApplyDone: hasGitApplyCompleted(gitRequests),
    prLinked: gitRequests.some((g) => g.pullRequestNumber != null),
  };

  let currentStep: IdeaUxStepId = 1;
  let allComplete = false;
  let primaryAction: IdeaUxPrimaryAction = {
    id: "scroll_upload",
    label: "업로드 영역으로 이동",
    description: "ProjectSpec 파일을 등록해 아이디어를 구체화하세요.",
  };
  let scrollAnchor = IDEA_UX_ANCHORS[1];

  // --- Determine current step (first incomplete) ---
  if (uploadHistory.length === 0) {
    currentStep = 1;
    scrollAnchor = IDEA_UX_ANCHORS[1];
    if (input.canRegisterSpec) {
      primaryAction = {
        id: "scroll_upload",
        label: "스펙 업로드로 이동",
        description: "아래에서 스펙 파일을 선택해 업로드하세요.",
      };
    } else {
      primaryAction = {
        id: "scroll_upload",
        label: "업로드 영역 확인",
        description: "PLANNER·OWNER 권한이 필요합니다. 담당자에게 요청하세요.",
      };
    }
  } else if (!hasParsedSpec(uploadHistory)) {
    currentStep = 2;
    scrollAnchor = IDEA_UX_ANCHORS[2];
    const up = firstUnparsedUploadId(uploadHistory);
    if (!input.canReview) {
      primaryAction = {
        id: "scroll_history",
        label: "업로드 이력으로 이동",
        description: "REVIEWER 이상에서 Parsing을 실행할 수 있습니다.",
      };
    } else if (up) {
      primaryAction = {
        id: "run_parse",
        label: "Parsing 실행",
        description: "업로드된 스펙을 파싱해 기능 정의를 완료하세요.",
        uploadId: up,
      };
    } else {
      primaryAction = {
        id: "scroll_history",
        label: "이력으로 이동",
        description: "파싱 가능한 업로드 항목을 확인하세요.",
      };
    }
  } else if (tasks.length === 0) {
    currentStep = 3;
    scrollAnchor = IDEA_UX_ANCHORS[3];
    const parsedId =
      firstParsedUploadId(uploadHistory) ?? uploadHistory[0]?.id ?? null;
    if (!input.canReview) {
      primaryAction = {
        id: "scroll_history",
        label: "이력으로 이동",
        description: "Task 생성은 REVIEWER 이상 권한이 필요합니다.",
      };
    } else if (parsedId) {
      primaryAction = {
        id: "generate_tasks",
        label: "Task 생성",
        description: "파싱된 스펙에서 작업 목록을 생성하세요.",
        uploadId: parsedId,
      };
    } else {
      primaryAction = {
        id: "scroll_history",
        label: "이력으로 이동",
        description: "Task 생성할 업로드를 선택하세요.",
      };
    }
  } else {
    const tp = firstTaskWithoutPrompt(tasks, taskPromptMap);
    if (tp) {
      currentStep = 4;
      scrollAnchor = IDEA_UX_ANCHORS[4];
      if (!input.canReview) {
        primaryAction = {
          id: "scroll_tasks",
          label: "Task 목록으로 이동",
          description: "프롬프트 생성은 REVIEWER 이상에서 가능합니다.",
        };
      } else {
        primaryAction = {
          id: "generate_prompt",
          label: "프롬프트 생성",
          description: `「${tp.name}」에 대한 프롬프트를 만든 뒤 실행 단계로 넘어가세요.`,
          taskId: tp.id,
        };
      }
    } else {
      const markReady = firstDoneRunNeedingReady(tasks, taskRuns);
      if (markReady && input.canOperate) {
        currentStep = 4;
        scrollAnchor = IDEA_UX_ANCHORS[4];
        primaryAction = {
          id: "mark_ready_for_git",
          label: "Git 반영 준비",
          description: "완료된 Run을 Git 반영 준비(READY_FOR_GIT)로 표시하세요.",
          taskId: markReady.taskId,
        };
      } else if (markReady && !input.canOperate) {
        currentStep = 4;
        scrollAnchor = IDEA_UX_ANCHORS[4];
        primaryAction = {
          id: "scroll_tasks",
          label: "Task 목록으로 이동",
          description: "OPERATOR 이상에서 Git 반영 준비를 진행할 수 있습니다.",
        };
      } else {
        const needRun = firstTaskNeedingRun(tasks, taskRunMap);
        const hasReady = taskRuns.some((r) => r.status === "READY_FOR_GIT");
        if (!hasReady && needRun) {
          currentStep = 4;
          scrollAnchor = IDEA_UX_ANCHORS[4];
          if (!input.canOperate) {
            primaryAction = {
              id: "scroll_tasks",
              label: "Task 목록으로 이동",
              description: "Run 실행은 OPERATOR 이상에서 가능합니다.",
            };
          } else {
            primaryAction = {
              id: "run_task",
              label: "Run 실행",
              description: `「${needRun.name}」Task를 실행해 결과를 만드세요.`,
              taskId: needRun.id,
            };
          }
        } else {
          if (taskRuns.some((r) => r.status === "RUNNING")) {
            currentStep = 4;
            scrollAnchor = IDEA_UX_ANCHORS[4];
            primaryAction = {
              id: "scroll_tasks",
              label: "실행 완료 대기",
              description: "Run이 끝나면 자동으로 다음 안내가 갱신됩니다. 목록에서 상태를 확인하세요.",
            };
          } else {
            const reg = firstReadyForGitRunWithoutGcr(taskRuns, gitRequests);
            if (reg) {
              currentStep = 5;
              scrollAnchor = IDEA_UX_ANCHORS[5];
              if (!input.canOperate) {
                primaryAction = {
                  id: "scroll_tasks",
                  label: "Task 목록으로 이동",
                  description: "Git 요청 등록은 OPERATOR 이상에서 가능합니다.",
                };
              } else {
                primaryAction = {
                  id: "register_git_request",
                  label: "Git 반영 요청 등록",
                  description: "준비된 Run에 대해 Git 반영 요청을 등록하세요.",
                  taskId: reg.taskId,
                };
              }
            } else if (gitRequests.length > 0 && !hasGitApplyCompleted(gitRequests)) {
              currentStep = 6;
              scrollAnchor = IDEA_UX_ANCHORS[6];
              const failedId = firstFailedGitApplyId(gitRequests);
              const applyTarget = firstGitNeedingApply(gitRequests);
              if (!input.canOperate) {
                primaryAction = {
                  id: "scroll_git",
                  label: "Git 반영 영역으로 이동",
                  description: "Git 반영은 OPERATOR 이상에서 진행합니다.",
                };
              } else if (failedId) {
                primaryAction = {
                  id: "retry_git_apply",
                  label: "Git 반영 재시도",
                  description: "실패 원인을 확인한 뒤 재시도하세요.",
                  gitChangeRequestId: failedId,
                };
              } else if (applyTarget) {
                primaryAction = {
                  id: "apply_git",
                  label: "Git 반영 실행",
                  description: "정책에 따라 승인 후 반영을 실행하세요.",
                  gitChangeRequestId: applyTarget.id,
                };
              } else {
                primaryAction = {
                  id: "scroll_git",
                  label: "Git 반영 영역으로 이동",
                  description: "승인 대기·적용 대기 항목을 확인하세요.",
                };
              }
            } else if (needsPrCollaboration(gitRequests)) {
              currentStep = 7;
              scrollAnchor = IDEA_UX_ANCHORS[7];
              const prRow = firstDoneGitNeedingPr(gitRequests);
              if (!input.canOperate) {
                primaryAction = {
                  id: "scroll_git",
                  label: "PR 영역으로 이동",
                  description: "PR 작업은 OPERATOR 이상에서 진행할 수 있습니다.",
                };
              } else if (prRow) {
                primaryAction = {
                  id: "create_pr",
                  label: "PR 생성",
                  description:
                    "Push가 완료된 요청입니다. GitHub PR을 생성하거나 아래 목록에서 동기화하세요.",
                  gitChangeRequestId: prRow.id,
                };
              } else {
                primaryAction = {
                  id: "scroll_git",
                  label: "Git 영역으로 이동",
                  description: "PR이 필요한 항목을 확인하세요.",
                };
              }
            } else if (
              tasks.length > 0 &&
              hasGitApplyCompleted(gitRequests) &&
              !needsPrCollaboration(gitRequests)
            ) {
              allComplete = true;
              currentStep = 7;
              scrollAnchor = IDEA_UX_ANCHORS[7];
              primaryAction = {
                id: "none",
                label: "흐름 완료",
                description:
                  "주요 단계를 마쳤습니다. 필요 시 「고급 보기」에서 세부 기능을 이용하세요.",
              };
            } else {
              currentStep = 4;
              scrollAnchor = IDEA_UX_ANCHORS[4];
              primaryAction = {
                id: "scroll_tasks",
                label: "Task 목록 확인",
                description:
                  "Run 실행·완료 처리·Git 반영 준비 상태를 Task 목록에서 확인하세요.",
              };
            }
          }
        }
      }
    }
  }

  const steps: { id: IdeaUxStepId; done: boolean }[] = IDEA_UX_STEP_IDS.map((id) => ({
    id,
    done: allComplete ? true : id < currentStep,
  }));

  return {
    currentStep,
    allComplete,
    steps,
    primaryAction,
    achievements,
    scrollAnchor,
  };
}
