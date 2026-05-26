/**
 * 구현 단계 SingleChat 인터뷰 칩 → 동작 라우팅.
 */

import {
  CODE_AGENT_WIP_WORK_REQUEST_CHIP,
  LEGACY_CURSOR_EXECUTION_REQUEST_CHIP,
  LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";

import { IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP } from "@/lib/prototype/implementationOrchestrationSummary";
import {
  DATA_MODEL_DRAFT_CHIP,
  DB_INTEGRATION_REVIEW_CHIP,
  MOCK_IMPLEMENTATION_CHIP,
} from "@/lib/prototype/implementationDbStrategy";
import {
  WORK_PLAN_DRAFT_GENERATE_CHIP,
  WORK_PLAN_SCOPE_DIRECT_INPUT_CHIP,
} from "@/lib/prototype/implementationWorkPlanDraft";

export type PrototypeExecutionChipHandlers = Readonly<{
  readonly openEnvSettings: () => void;
  readonly openArtifactHub: () => void;
  readonly focusComposerForScopeEdit: () => void;
  readonly showRoleCheckDetails: () => void;
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
    case "환경설정 열기":
      handlers.openEnvSettings();
      return true;
    case "산출물 다시 보기":
      handlers.openArtifactHub();
      return true;
    case WORK_PLAN_SCOPE_DIRECT_INPUT_CHIP:
    case "구현 범위 수정":
    case "작업 범위 수정":
      handlers.focusComposerForScopeEdit();
      return true;
    case WORK_PLAN_DRAFT_GENERATE_CHIP:
      handlers.generateImplementationWorkPlanDraft();
      return true;
    case IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP:
      handlers.showRoleCheckDetails();
      return true;
    case "구현 작업안 확정": {
      if (!handlers.canConfirmImplementationTaskPlan()) return true;
      handlers.confirmImplementationTaskPlan();
      return true;
    }
    case CODE_AGENT_WIP_WORK_REQUEST_CHIP:
    case LEGACY_CURSOR_WIP_WORK_REQUEST_CHIP:
    case LEGACY_CURSOR_EXECUTION_REQUEST_CHIP: {
      if (!handlers.canRequestCodeAgentWipWork()) return true;
      handlers.requestCodeAgentWipWork();
      return true;
    }
    case "변경사항 보기":
      handlers.viewWipChanges();
      return true;
    case "리팩토링 요청":
      handlers.requestRefactor();
      return true;
    case "추가 수정 요청":
      handlers.requestAdditionalEdit();
      return true;
    case "구현 결과 승인": {
      if (!handlers.canApproveDeveloperResult()) return true;
      handlers.approveDeveloperResult();
      return true;
    }
    case "작업 폐기":
      handlers.discardWipWork();
      return true;
    case "SCM에게 공식 반영 요청": {
      if (!handlers.canRequestScmOfficialCommit()) return true;
      handlers.requestScmOfficialCommit();
      return true;
    }
    case DB_INTEGRATION_REVIEW_CHIP:
      handlers.reviewDbIntegrationNeed();
      return true;
    case DATA_MODEL_DRAFT_CHIP:
      handlers.generateDataModelDraft();
      return true;
    case MOCK_IMPLEMENTATION_CHIP:
      handlers.confirmMockImplementationMode();
      return true;
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
