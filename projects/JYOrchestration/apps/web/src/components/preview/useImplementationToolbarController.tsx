"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { WorkspaceHubChromeIconButton } from "@/components/workspace/WorkspaceHubChromeIconButton";
import { IMPLEMENTATION_ENV_SETTINGS_LABEL } from "@/lib/requirements/implementationUxLabels";

/**
 * Builds implementation-stage toolbar actions.
 *
 * Scope:
 * - expose execution environment settings open handler
 * - build implementation conversation icon toolbar
 * - wire execution log open action into toolbar
 *
 * Not scope:
 * - execution log state management
 * - environment settings modal implementation
 * - board rendering
 * - CodeTask execution
 */
export type ImplementationToolbarControllerInput = Readonly<{
  readonly setExecutionEnvironmentModalOpen: (open: boolean) => void;
  readonly onOpenImplementationExecutionLog: () => void;
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
      </>
    ),
    [onOpenExecutionEnvironmentSettings, input.onOpenImplementationExecutionLog],
  );

  return {
    onOpenExecutionEnvironmentSettings,
    executionConversationIconToolbar,
  };
}
