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
  1: "guided-flow-spec-workspace",
  2: "guided-flow-spec-workspace",
  3: "guided-flow-spec-workspace",
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
  3: { title: "작업 생성", short: "작업 생성" },
  4: { title: "실행", short: "실행" },
  5: { title: "저장 준비", short: "저장 준비" },
  6: { title: "저장소에 반영", short: "저장소" },
  7: { title: "팀과 공유", short: "공유" },
};

export type IdeaUxStepStatus = "not_started" | "current" | "done";

function stepStatusFor(
  id: IdeaUxStepId,
  currentStep: IdeaUxStepId,
  allComplete: boolean
): IdeaUxStepStatus {
  if (allComplete) {
    return "done";
  }
  if (id < currentStep) {
    return "done";
  }
  if (id === currentStep) {
    return "current";
  }
  return "not_started";
}

export type IdeaUxActionId =
  | "scroll_upload"
  | "scroll_history"
  | "scroll_tasks"
  | "scroll_git"
  | "run_parse"
  | "generate_tasks"
  | "generate_prompt"
  | "run_task"
  | "retry_run"
  | "follow_up"
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

/** 단계별 완료 체감용 (Step Navigator·Action Panel 공통) */
export type IdeaUxMilestones = {
  specUploaded: boolean;
  parsed: boolean;
  tasksCreated: boolean;
  promptsReady: boolean;
  runSucceeded: boolean;
  gitApplied: boolean;
  prLinked: boolean;
};

export type IdeaGuidedUxSnapshot = {
  currentStep: IdeaUxStepId;
  allComplete: boolean;
  steps: { id: IdeaUxStepId; status: IdeaUxStepStatus }[];
  primaryAction: IdeaUxPrimaryAction;
  achievements: IdeaUxAchievements;
  milestones: IdeaUxMilestones;
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
  /** 워크스페이스에 Spec 관련 필드가 채워져 업로드 없이도 진행 가능한 상태 */
  workspaceSpecStarted?: boolean;
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
  const workspaceSpecStarted = input.workspaceSpecStarted ?? false;

  const achievements: IdeaUxAchievements = {
    taskRunReady: taskRuns.some(
      (r) => r.status === "READY_FOR_GIT" || r.status === "DONE"
    ),
    gitApplyDone: hasGitApplyCompleted(gitRequests),
    prLinked: gitRequests.some((g) => g.pullRequestNumber != null),
  };

  const milestones: IdeaUxMilestones = {
    specUploaded: uploadHistory.length > 0 || workspaceSpecStarted,
    parsed:
      hasParsedSpec(uploadHistory) ||
      (uploadHistory.length === 0 && workspaceSpecStarted),
    tasksCreated: tasks.length > 0,
    promptsReady:
      tasks.length > 0 && tasks.every((t) => Boolean(taskPromptMap[t.id])),
    runSucceeded: taskRuns.some((r) => r.status === "DONE"),
    gitApplied: hasGitApplyCompleted(gitRequests),
    prLinked: gitRequests.some((g) => g.pullRequestNumber != null),
  };

  let currentStep: IdeaUxStepId = 1;
  let allComplete = false;
  let primaryAction: IdeaUxPrimaryAction = {
    id: "scroll_upload",
    label: "프로젝트 계획 입력",
    description: "워크스페이스에서 기본 정보와 실행 계획을 정리한 뒤 저장하고 이어서 진행하세요.",
  };
  let scrollAnchor = IDEA_UX_ANCHORS[1];

  // --- Determine current step (first incomplete) ---
  if (uploadHistory.length === 0 && !workspaceSpecStarted) {
    currentStep = 1;
    scrollAnchor = IDEA_UX_ANCHORS[1];
    if (input.canRegisterSpec) {
      primaryAction = {
        id: "scroll_upload",
        label: "프로젝트 계획·Spec 정의하기",
        description:
          "기본 정보 → AI 실행 계획 초안 → 편집·저장 순으로 워크스페이스에서 진행하세요. 파일 업로드는 필수가 아닙니다.",
      };
    } else {
      primaryAction = {
        id: "scroll_upload",
        label: "워크스페이스 확인",
        description: "Spec 편집 권한이 필요합니다. 담당자에게 부탁하세요.",
      };
    }
  } else if (uploadHistory.length > 0 && !hasParsedSpec(uploadHistory)) {
    currentStep = 2;
    scrollAnchor = IDEA_UX_ANCHORS[2];
    const up = firstUnparsedUploadId(uploadHistory);
    if (!input.canReview) {
      primaryAction = {
        id: "scroll_history",
        label: "업로드 이력 보기",
        description: "문서를 읽고 정리하는 작업은 검토 권한이 있는 분만 할 수 있습니다.",
      };
    } else if (up) {
      primaryAction = {
        id: "run_parse",
        label: "문서 내용 정리하기",
        description: "올린 문서를 읽어 기능 목록으로 정리합니다.",
        uploadId: up,
      };
    } else {
      primaryAction = {
        id: "scroll_history",
        label: "업로드 이력으로 이동",
        description: "아직 정리되지 않은 문서가 있는지 목록에서 확인하세요.",
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
        label: "업로드 이력 보기",
        description: "할 일 목록 만들기는 검토 권한이 있는 분만 할 수 있습니다.",
      };
    } else if (parsedId) {
      primaryAction = {
        id: "generate_tasks",
        label: "할 일 목록 만들기",
        description: "정리된 내용을 바탕으로 실제로 할 일 목록을 만듭니다.",
        uploadId: parsedId,
      };
    } else if (workspaceSpecStarted) {
      primaryAction = {
        id: "scroll_tasks",
        label: "할 일 목록 확인",
        description:
          "워크스페이스에서 Project Spec을 확정하면 Task 초안이 준비됩니다. 아래 할 일 목록에서 이어서 확인하세요.",
      };
    } else {
      primaryAction = {
        id: "scroll_upload",
        label: "워크스페이스로 이동",
        description: "업로드 문서를 정리하거나, 워크스페이스에서 계획을 저장해 주세요.",
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
          label: "할 일 목록 보기",
          description: "실행 지침 만들기는 검토 권한이 있는 분만 할 수 있습니다.",
        };
      } else {
        primaryAction = {
          id: "generate_prompt",
          label: "실행 지침 만들기",
          description: `「${tp.name}」에 대해 자동 실행에 쓸 안내 문장을 만듭니다.`,
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
          label: "저장 준비하기",
          description: "끝난 실행을 다음 단계(저장소에 반영)로 넘길 준비를 합니다.",
          taskId: markReady.taskId,
        };
      } else if (markReady && !input.canOperate) {
        currentStep = 4;
        scrollAnchor = IDEA_UX_ANCHORS[4];
        primaryAction = {
          id: "scroll_tasks",
          label: "할 일 목록 보기",
          description: "저장 준비는 실행 권한이 있는 분만 할 수 있습니다.",
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
              label: "할 일 목록 보기",
              description: "자동 실행은 실행 권한이 있는 분만 할 수 있습니다.",
            };
          } else {
            primaryAction = {
              id: "run_task",
              label: "자동 실행하기",
              description: `「${needRun.name}」을(를) 실행해 결과를 만듭니다.`,
              taskId: needRun.id,
            };
          }
        } else {
          if (taskRuns.some((r) => r.status === "RUNNING")) {
            currentStep = 4;
            scrollAnchor = IDEA_UX_ANCHORS[4];
            primaryAction = {
              id: "scroll_tasks",
              label: "실행 상태 확인",
              description: "실행이 끝나면 자동으로 다음 안내가 바뀝니다. 잠시만 기다려 주세요.",
            };
          } else {
            const reg = firstReadyForGitRunWithoutGcr(taskRuns, gitRequests);
            if (reg) {
              currentStep = 5;
              scrollAnchor = IDEA_UX_ANCHORS[5];
              if (!input.canOperate) {
                primaryAction = {
                  id: "scroll_tasks",
                  label: "할 일 목록 보기",
                  description: "저장소 반영 요청은 실행 권한이 있는 분만 할 수 있습니다.",
                };
              } else {
                primaryAction = {
                  id: "register_git_request",
                  label: "저장소 반영 요청",
                  description: "준비된 실행에 대해 저장소에 반영해 달라고 요청합니다.",
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
                  label: "저장소 반영 화면 보기",
                  description: "저장소 반영은 실행 권한이 있는 분만 할 수 있습니다.",
                };
              } else if (failedId) {
                primaryAction = {
                  id: "retry_git_apply",
                  label: "다시 반영하기",
                  description: "아래에서 이유를 확인한 뒤 다시 시도해 보세요.",
                  gitChangeRequestId: failedId,
                };
              } else if (applyTarget) {
                primaryAction = {
                  id: "apply_git",
                  label: "저장소에 반영",
                  description: "정해진 절차에 따라 승인 후 반영을 진행합니다.",
                  gitChangeRequestId: applyTarget.id,
                };
              } else {
                primaryAction = {
                  id: "scroll_git",
                  label: "저장소 반영 화면 보기",
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
                  label: "공유 화면 보기",
                  description: "팀 공유·협업은 실행 권한이 있는 분만 할 수 있습니다.",
                };
              } else if (prRow) {
                primaryAction = {
                  id: "create_pr",
                  label: "팀에 공유 요청",
                  description:
                    "원격 저장소에 올라간 뒤입니다. 팀과 공유할 요청을 만들거나 연결하세요.",
                  gitChangeRequestId: prRow.id,
                };
              } else {
                primaryAction = {
                  id: "scroll_git",
                  label: "공유 상태 확인",
                  description: "공유가 필요한 항목을 확인하세요.",
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
                  "주요 단계를 마쳤습니다. 더 보기는 아래 「전체 기능 펼치기」에서 할 수 있습니다.",
              };
            } else {
              currentStep = 4;
              scrollAnchor = IDEA_UX_ANCHORS[4];
              primaryAction = {
                id: "scroll_tasks",
                label: "할 일 목록 확인",
                description:
                  "실행·완료·저장 준비 상태를 할 일 목록에서 확인하세요.",
              };
            }
          }
        }
      }
    }
  }

  const steps: { id: IdeaUxStepId; status: IdeaUxStepStatus }[] = IDEA_UX_STEP_IDS.map(
    (id) => ({
      id,
      status: stepStatusFor(id, currentStep, allComplete),
    })
  );

  return {
    currentStep,
    allComplete,
    steps,
    primaryAction,
    achievements,
    milestones,
    scrollAnchor,
  };
}
