"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { WorkspaceHubChromeIconButton } from "@/components/workspace/WorkspaceHubChromeIconButton";
import {
  IMPLEMENTATION_DEVELOPER_DASHBOARD_TOOLBAR_ARIA,
  IMPLEMENTATION_DEVELOPER_DASHBOARD_TOOLBAR_TITLE,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_QUICK_EXECUTION_TOOLBAR_ARIA,
  IMPLEMENTATION_QUICK_EXECUTION_TOOLBAR_TITLE,
  IMPLEMENTATION_WORKING_QUEUE_TOOLBAR_ARIA,
  IMPLEMENTATION_WORKING_QUEUE_TOOLBAR_TITLE,
} from "@/lib/requirements/implementationUxLabels";

/**
 * Builds implementation-stage toolbar actions.
 *
 * Scope:
 * - expose execution environment settings open handler
 * - build implementation conversation icon toolbar
 * - wire execution log open action into toolbar
 * - wire implementation session reset into toolbar
 * - wire selected CodeTask quick run into toolbar
 *
 * Not scope:
 * - execution log state management
 * - environment settings modal implementation
 * - board rendering
 * - CodeTask execution
 */
export type ImplementationToolbarControllerInput = Readonly<{
  readonly setExecutionEnvironmentModalOpen: (open: boolean) => void;
  readonly onOpenDeveloperDashboard?: () => void;
  readonly developerDashboardDisabled?: boolean;
  readonly onOpenWorkingQueue?: () => void;
  readonly workingQueuePendingCount?: number;
  readonly onOpenImplementationExecutionLog: () => void;
  readonly onResetImplementationSession?: () => void | Promise<void>;
  readonly resetImplementationSessionDisabled?: boolean;
  readonly onExecuteSelectedCodeTasks?: () => void | Promise<void>;
  readonly executeSelectedCodeTasksDisabled?: boolean;
  readonly executeSelectedCodeTasksEmphasized?: boolean;
}>;

export type ImplementationToolbarControllerValue = Readonly<{
  readonly onOpenExecutionEnvironmentSettings: () => void;
  readonly executionConversationIconToolbar: ReactNode;
}>;

export function useImplementationToolbarController(
  input: ImplementationToolbarControllerInput,
): ImplementationToolbarControllerValue {
  const onOpenExecutionEnvironmentSettings = useCallback(() => {
    input.setExecutionEnvironmentModalOpen(true);
  }, [input.setExecutionEnvironmentModalOpen]);

  const executionConversationIconToolbar = useMemo(
    () => (
      <>
        {input.onOpenDeveloperDashboard ? (
          <WorkspaceHubChromeIconButton
            title={IMPLEMENTATION_DEVELOPER_DASHBOARD_TOOLBAR_TITLE}
            ariaLabel={IMPLEMENTATION_DEVELOPER_DASHBOARD_TOOLBAR_ARIA}
            disabled={input.developerDashboardDisabled ?? false}
            onClick={input.onOpenDeveloperDashboard}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </WorkspaceHubChromeIconButton>
        ) : null}
        {input.onOpenWorkingQueue ? (
          <WorkspaceHubChromeIconButton
            title={IMPLEMENTATION_WORKING_QUEUE_TOOLBAR_TITLE}
            ariaLabel={IMPLEMENTATION_WORKING_QUEUE_TOOLBAR_ARIA}
            disabled={false}
            onClick={input.onOpenWorkingQueue}
            badge={
              (input.workingQueuePendingCount ?? 0) > 0 ? input.workingQueuePendingCount : null
            }
            badgeTone="stale"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </svg>
          </WorkspaceHubChromeIconButton>
        ) : null}
        {input.onExecuteSelectedCodeTasks ? (
          <WorkspaceHubChromeIconButton
            title={IMPLEMENTATION_QUICK_EXECUTION_TOOLBAR_TITLE}
            ariaLabel={IMPLEMENTATION_QUICK_EXECUTION_TOOLBAR_ARIA}
            disabled={input.executeSelectedCodeTasksDisabled ?? true}
            emphasisTone={input.executeSelectedCodeTasksEmphasized ? "amber" : "default"}
            onClick={() => void input.onExecuteSelectedCodeTasks?.()}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </WorkspaceHubChromeIconButton>
        ) : null}
        <WorkspaceHubChromeIconButton
          title={IMPLEMENTATION_ENV_SETTINGS_LABEL}
          ariaLabel={IMPLEMENTATION_ENV_SETTINGS_LABEL}
          disabled={false}
          onClick={onOpenExecutionEnvironmentSettings}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </WorkspaceHubChromeIconButton>
        <WorkspaceHubChromeIconButton
          title="상세 로그 보기"
          ariaLabel="상세 로그 보기"
          disabled={false}
          onClick={input.onOpenImplementationExecutionLog}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 12h-5" />
            <path d="M15 8h-5" />
            <path d="M19 17V5a2 2 0 0 0-2-2H4" />
            <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" />
          </svg>
        </WorkspaceHubChromeIconButton>
        {input.onResetImplementationSession ? (
          <WorkspaceHubChromeIconButton
            title="구현 단계 초기화"
            ariaLabel="구현 단계 초기화 — 구현 대화·실행 기록·Runtime 데이터 삭제"
            disabled={input.resetImplementationSessionDisabled ?? false}
            onClick={() => void input.onResetImplementationSession?.()}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </WorkspaceHubChromeIconButton>
        ) : null}
      </>
    ),
    [
      onOpenExecutionEnvironmentSettings,
      input.onOpenDeveloperDashboard,
      input.developerDashboardDisabled,
      input.onOpenWorkingQueue,
      input.workingQueuePendingCount,
      input.onOpenImplementationExecutionLog,
      input.onResetImplementationSession,
      input.resetImplementationSessionDisabled,
      input.onExecuteSelectedCodeTasks,
      input.executeSelectedCodeTasksDisabled,
      input.executeSelectedCodeTasksEmphasized,
    ],
  );

  return {
    onOpenExecutionEnvironmentSettings,
    executionConversationIconToolbar,
  };
}
