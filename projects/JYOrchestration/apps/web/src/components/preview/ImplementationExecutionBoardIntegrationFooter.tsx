"use client";

import type { ReactNode } from "react";
import { IntegrationPreviewRemediationPanel } from "@/components/preview/IntegrationPreviewRemediationPanel";
import { openActualIntegratedPreviewInNewWindow } from "@/lib/prototype/actualIntegratedPreviewOpenAction";
import type { ImplementationPreviewEntryModeV1 } from "@/lib/prototype/implementationPreviewEntryPolicy";
import type { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import type { evaluateImplementationPreviewButtonState } from "@/lib/prototype/implementationPreviewButtonPolicy";
import type { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import { resolveIntegrationPipelineBusyLabel, mapIntegrationPipelineStatusToUiPhase } from "@/lib/prototype/implementationIntegrationPipelineUiStatus";

type IntegrationButtonState = ReturnType<typeof evaluateIntegrationPipelineButtonFromSnapshot>;
type PreviewButtonState = ReturnType<typeof evaluateImplementationPreviewButtonState>;
type IntegrationSection = ReturnType<typeof buildImplementationIntegrationBoardSection>;

export function ImplementationExecutionBoardIntegrationFooter(props: {
  readonly projectId: string;
  readonly boardProjectId: string;
  readonly showIntegrationFooter: boolean;
  readonly showIntegrationButton: boolean;
  readonly integrationButtonEnabled: boolean;
  readonly integrationButtonState: IntegrationButtonState;
  readonly integrationPipelineBusy?: boolean;
  readonly integrationSection: IntegrationSection;
  readonly previewButtonState: PreviewButtonState;
  readonly integrationPipelineStatus?: string;
  readonly targetRepositoryGitRepoUrl: string | null | undefined;
  readonly executionSetupGitRepoUrl: string | null | undefined;
  readonly onRunIntegrationPipeline?: () => void;
  readonly onMergeIntegrationPullRequest?: () => void;
  readonly integrationMergeBusy?: boolean;
  readonly onOpenImplementationPreview?: (input: {
    readonly mode: ImplementationPreviewEntryModeV1;
    readonly url: string;
  }) => void;
}): ReactNode {
  if (!props.showIntegrationFooter) return null;
  return (
    <section
      className={[styles.taskTreeSection, styles.integrationFooterSticky].join(" ")}
      data-testid="implementation-integrated-pipeline-section"
    >
      <div className={styles.integrationSectionHeader}>
        <div className={styles.integrationSectionActions}>
          {props.showIntegrationButton ? (
            <button
              type="button"
              className={styles.integrationPrimaryButton}
              data-testid="implementation-integration-run-button"
              disabled={props.integrationPipelineBusy === true || !props.integrationButtonEnabled}
              aria-disabled={props.integrationPipelineBusy === true || !props.integrationButtonEnabled}
              title={props.integrationButtonState.disabledTitle ?? undefined}
              onClick={props.onRunIntegrationPipeline}
            >
              {props.integrationPipelineBusy
                ? resolveIntegrationPipelineBusyLabel({
                    busy: true,
                    phase: mapIntegrationPipelineStatusToUiPhase(props.integrationPipelineStatus),
                    continueBuildPreview: props.integrationButtonState.continueBuildPreview,
                    buttonLabel: props.integrationButtonState.buttonLabel,
                  }) ?? "통합 및 Preview 준비 중…"
                : props.integrationButtonState.buttonLabel || "통합 및 Preview 준비"}
            </button>
          ) : null}
          {props.integrationSection.integrationPullRequestUrl ? (
            <button
              type="button"
              className={styles.integrationPreviewScopeButton}
              data-testid="implementation-integration-pr-open-button"
              onClick={() => {
                window.open(
                  props.integrationSection.integrationPullRequestUrl!,
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
            >
              PR 열기
            </button>
          ) : null}
          {props.integrationSection.canMergeIntegrationPullRequest && props.onMergeIntegrationPullRequest ? (
            <button
              type="button"
              className={styles.integrationPrimaryButton}
              data-testid="implementation-integration-merge-main-button"
              disabled={props.integrationMergeBusy === true}
              onClick={props.onMergeIntegrationPullRequest}
            >
              {props.integrationMergeBusy ? "main 반영 중…" : "main에 반영"}
            </button>
          ) : null}
          {props.previewButtonState.show || props.integrationSection.integratedAppPreviewReady ? (
            <button
              type="button"
              className={styles.integrationPreviewButton}
              data-testid="implementation-preview-open-button"
              disabled={!props.previewButtonState.enabled || !props.previewButtonState.url}
              title={props.previewButtonState.title}
              onClick={() => {
                if (!props.previewButtonState.enabled || !props.previewButtonState.url) return;
                const pid = (props.projectId || props.boardProjectId).trim();
                if (props.onOpenImplementationPreview) {
                  props.onOpenImplementationPreview({
                    mode: "integrated_app_preview",
                    url: props.previewButtonState.url,
                  });
                  return;
                }
                openActualIntegratedPreviewInNewWindow({
                  projectId: pid,
                  url: props.previewButtonState.url,
                });
              }}
            >
              {props.previewButtonState.label}
            </button>
          ) : null}
        </div>
      </div>
      <IntegrationPreviewRemediationPanel
        pipelineStatus={props.integrationPipelineStatus}
        gitRepoUrl={props.targetRepositoryGitRepoUrl ?? props.executionSetupGitRepoUrl ?? null}
        onRetryIntegration={props.onRunIntegrationPipeline}
      />
    </section>
  );
}
