/**
 * 구현 단계 SingleChat 인터뷰 칩 fallback 라우팅.
 *
 * Primary implementation stage CTAs are mapped by `mapImplementationChipToAction()` and executed via
 * `executeImplementationStageAction()` in PrototypePreviewPanel (gate + persist + timeline).
 *
 * Fallback remains for planning navigation, WIP review, SCM officialization, and legacy prototype run controls.
 */

import {
  CODE_AGENT_WIP_WORK_REQUEST_CHIP,
  LEGACY_CURSOR_EXECUTION_REQUEST_CHIP,
  LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";
import {
  IMPLEMENTATION_SEED_CONFIRM_CANDIDATES_CHIP,
  PLANNING_IMPLEMENTATION_SEED_CHECK_CHIP,
  PLANNING_IMPLEMENTATION_SEED_GENERATE_CHIP,
} from "@/lib/requirements/implementationSeed";
import {
  IMPLEMENTATION_RETURN_TO_PLANNING_CHIP,
  IMPLEMENTATION_TASK_LIST_CHIP_LABELS,
} from "@/lib/prototype/implementationTaskListEntryMessage";
import { IMPLEMENTATION_BLOCKED_RETURN_TO_PLANNING_CHIP } from "@/lib/prototype/implementationWorkPlanDraft";

export type PrototypeExecutionChipHandlers = Readonly<{
  readonly openEnvSettings: () => void;
  readonly openArtifactHub: () => void;
  readonly returnToPlanningStage?: () => void;
  readonly showImplementationSeedReadinessCheck?: () => void;
  readonly focusComposerForScopeEdit: () => void;
  readonly showRoleCheckDetails: () => void;
  readonly showScmCheckDetails: () => void;
  readonly showEnvironmentCheckDetails: () => void;
  readonly generateImplementationWorkPlanDraft: () => void;
  readonly confirmImplementationTaskPlan: () => void;
  readonly requestCodeAgentWipWork: () => void;
  readonly viewWipChanges: () => void;
  readonly requestRefactor: () => void;
  readonly requestAdditionalEdit: () => void;
  readonly approveDeveloperResult: () => void;
  readonly discardWipWork: () => void;
  readonly requestScmOfficialCommit: () => void;
  readonly reviewDbIntegrationNeed: () => void;
  readonly generateDataModelDraft: () => void;
  readonly confirmMockImplementationMode: () => void;
  readonly prepareImplementationExecution: () => void;
  readonly confirmExecution: () => void;
  readonly refreshStatus: () => void;
  readonly showToast: (message: string) => void;
  readonly canConfirmImplementationTaskPlan: () => boolean;
  readonly canRequestCodeAgentWipWork: () => boolean;
  readonly canApproveDeveloperResult: () => boolean;
  readonly canRequestScmOfficialCommit: () => boolean;
  readonly canConfirmExecution: () => boolean;
}>;

export function tryHandlePrototypeExecutionChip(
  label: string,
  handlers: PrototypeExecutionChipHandlers,
): boolean {
  const t = label.trim();
  switch (t) {
    // Planning navigation / seed recovery
    case IMPLEMENTATION_BLOCKED_RETURN_TO_PLANNING_CHIP:
    case IMPLEMENTATION_RETURN_TO_PLANNING_CHIP:
    case PLANNING_IMPLEMENTATION_SEED_CHECK_CHIP:
    case IMPLEMENTATION_SEED_CONFIRM_CANDIDATES_CHIP:
    case PLANNING_IMPLEMENTATION_SEED_GENERATE_CHIP:
      if (t === PLANNING_IMPLEMENTATION_SEED_CHECK_CHIP && handlers.showImplementationSeedReadinessCheck) {
        handlers.showImplementationSeedReadinessCheck();
        return true;
      }
      if (handlers.returnToPlanningStage) {
        if (t === IMPLEMENTATION_SEED_CONFIRM_CANDIDATES_CHIP) {
          handlers.showToast("기획단계에서 Seed 후보를 확인·확정해 주세요.");
        } else if (t === PLANNING_IMPLEMENTATION_SEED_GENERATE_CHIP) {
          handlers.showToast("기획단계에서 AI팀이 구현 Seed 후보 생성을 실행해 주세요.");
        } else if (t === PLANNING_IMPLEMENTATION_SEED_CHECK_CHIP) {
          handlers.showToast("기획단계에서 구현 준비도를 점검해 주세요.");
        }
        handlers.returnToPlanningStage();
      } else {
        handlers.showToast("기획단계 화면으로 이동해 주세요.");
      }
      return true;

    // WIP result review
    case "변경사항 보기":
      handlers.viewWipChanges();
      return true;
    case "리팩토링 요청":
      handlers.requestRefactor();
      return true;
    case "추가 수정 요청":
      handlers.requestAdditionalEdit();
      return true;
    case "구현 결과 승인":
    case "WIP 초안 승인": {
      if (!handlers.canApproveDeveloperResult()) return true;
      handlers.approveDeveloperResult();
      return true;
    }
    case "작업 폐기":
      handlers.discardWipWork();
      return true;

    // SCM officialization
    case "SCM에게 공식 반영 요청": {
      if (!handlers.canRequestScmOfficialCommit()) return true;
      handlers.requestScmOfficialCommit();
      return true;
    }

    // Legacy prototype execution controls
    case "구현 실행 준비":
      handlers.prepareImplementationExecution();
      return true;
    case "구현 실행": {
      if (!handlers.canConfirmExecution()) return true;
      handlers.confirmExecution();
      return true;
    }
    case "상태 새로고침":
      handlers.refreshStatus();
      return true;
    default:
      return false;
  }
}

/** TaskList entry chips — handled by tryHandleImplementationTaskListChip before stage/fallback. */
export const TASK_LIST_HANDLED_CHIP_LABELS = [...IMPLEMENTATION_TASK_LIST_CHIP_LABELS] as const;

/** Labels routed only via stage action pipeline — fallback must not handle these. */
export const STAGE_ACTION_ONLY_CHIP_LABELS = [
  "구현 작업안 초안 생성",
  "구현 작업안 확정",
  "구현 범위 수정",
  "작업 범위 수정",
  "DB 연동 필요성 검토",
  "데이터 모델 초안 생성",
  "Mock 기반 구현 진행",
  "산출물 다시 보기",
  "환경설정 열기",
  "환경설정 보기",
  "역할별 점검 보기",
  "SCM 점검 결과",
  "SCM 점검 결과 보기",
  "환경 점검 결과",
  "환경설정 점검 결과",
  CODE_AGENT_WIP_WORK_REQUEST_CHIP,
  LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP,
  LEGACY_CURSOR_EXECUTION_REQUEST_CHIP,
] as const;

/** Labels handled only by fallback (not stage action mapping). */
export const FALLBACK_LEGACY_CHIP_LABELS = [
  "상태 새로고침",
  "변경사항 보기",
  "구현 실행",
  "구현 실행 준비",
  IMPLEMENTATION_BLOCKED_RETURN_TO_PLANNING_CHIP,
] as const;
