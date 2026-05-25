/**
 * 구현 단계 SingleChat 인터뷰 칩 → 동작 라우팅.
 */

export type PrototypeExecutionChipHandlers = Readonly<{
  readonly openEnvSettings: () => void;
  readonly openArtifactHub: () => void;
  readonly focusComposerForScopeEdit: () => void;
  readonly confirmImplementationTaskPlan: () => void;
  readonly requestCursorExecution: () => void;
  readonly prepareImplementationExecution: () => void;
  readonly confirmExecution: () => void;
  readonly refreshStatus: () => void;
  readonly showToast: (message: string) => void;
  readonly canConfirmImplementationTaskPlan: () => boolean;
  readonly canRequestCursorExecution: () => boolean;
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
    case "구현 범위 수정":
    case "작업 범위 수정":
      handlers.focusComposerForScopeEdit();
      return true;
    case "구현 작업안 확정": {
      if (!handlers.canConfirmImplementationTaskPlan()) return true;
      handlers.confirmImplementationTaskPlan();
      return true;
    }
    case "Cursor 실행 요청": {
      if (!handlers.canRequestCursorExecution()) return true;
      handlers.requestCursorExecution();
      return true;
    }
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
