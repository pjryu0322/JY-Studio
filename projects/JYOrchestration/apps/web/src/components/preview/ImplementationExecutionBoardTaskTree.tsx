"use client";

import { useEffect, useRef } from "react";
import type { ImplementationCodeTaskTreeNode } from "@/lib/prototype/implementationTaskTreeView";
import type { CodeTaskExecutionFlowStepVm } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import type { CodeAgentExecutionProgressView } from "@/lib/prototype/codeAgentExecutionProgressView";
import { buildCodeTaskInlineExecutionDetail } from "@/lib/prototype/implementationCodeTaskInlineExecution";
import { CodeTaskInlineExecutionDetailBlock } from "@/components/preview/CodeTaskInlineExecutionDetail";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

function CodeTaskCursorPromptCopyIcon({ size = 14 }: { readonly size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ExecutionFlowSteps({
  steps,
  onCopyCursorPrompt,
}: {
  readonly steps: readonly CodeTaskExecutionFlowStepVm[];
  readonly onCopyCursorPrompt?: () => void;
}) {
  if (!steps.length) return null;
  return (
    <div className={styles.taskTreeFlowBlock} data-testid="implementation-code-task-flow">
      <ol className={styles.taskTreeFlowList}>
        {steps.map((step) => {
          const marker =
            step.state === "done"
              ? "✓"
              : step.state === "active"
                ? "●"
                : step.state === "failed"
                  ? "✕"
                  : step.state === "skipped"
                    ? "−"
                    : "○";
          return (
            <li
              key={step.id}
              className={[
                styles.taskTreeFlowItem,
                step.state === "active" ? styles.taskTreeFlowItemActive : "",
                step.state === "done" ? styles.taskTreeFlowItemDone : "",
                step.state === "failed" ? styles.taskTreeFlowItemFailed : "",
                step.state === "skipped" ? styles.taskTreeFlowItemSkipped : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={styles.taskTreeFlowMarker} aria-hidden>
                {marker}
              </span>
              <span>{step.label}</span>
              {step.id === "prompt_ready" && onCopyCursorPrompt ? (
                <button
                  type="button"
                  className={styles.taskTreeCopyPromptButton}
                  aria-label="CodeTask 개발 프롬프트 복사"
                  title="이 CodeTask 2단계 개발 프롬프트 복사"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCopyCursorPrompt();
                  }}
                >
                  <CodeTaskCursorPromptCopyIcon />
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CodeTaskSelectedDetail({
  node,
  codeAgentProgress,
  onCopyCursorPrompt,
  onRetryFailedCodeTask,
}: {
  readonly node: ImplementationCodeTaskTreeNode;
  readonly codeAgentProgress?: CodeAgentExecutionProgressView;
  readonly onCopyCursorPrompt?: (codeTaskId: string) => void;
  readonly onRetryFailedCodeTask?: (codeTaskId: string) => void;
}) {
  const cursorMatchesParent =
    codeAgentProgress?.taskId === node.parentTaskId ||
    codeAgentProgress?.taskId === node.codeTaskId;
  const inlineExecution =
    cursorMatchesParent && codeAgentProgress
      ? buildCodeTaskInlineExecutionDetail({
          progress: codeAgentProgress,
          parentTaskId: node.parentTaskId,
          isSelected: true,
          executionFlowSteps: node.executionFlowSteps,
        })
      : undefined;
  const showInlineExecution = Boolean(
    inlineExecution?.technicalProgress || inlineExecution?.summaryLine,
  );

  return (
    <div
      className={styles.taskTreeCodeTaskDetail}
      data-testid={`implementation-code-task-detail-${node.codeTaskId}`}
    >
      {node.failureReason ? (
        <div className={styles.taskTreeFailureBlock}>
          <div className={styles.taskTreeMetaLine}>
            <span className={styles.taskTreeMetaKey}>사유</span>
            <span className={styles.taskTreeMetaValue}>{node.failureReason}</span>
          </div>
          {node.nextActionHint ? (
            <div className={styles.taskTreeMetaLine}>
              <span className={styles.taskTreeMetaKey}>다음 처리</span>
              <span className={styles.taskTreeMetaValue}>{node.nextActionHint}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {node.showRetryFailedAction && onRetryFailedCodeTask ? (
        <button
          type="button"
          className={styles.integrationPrimaryButton}
          data-testid={`implementation-retry-failed-code-task-${node.codeTaskId}`}
          onClick={() => onRetryFailedCodeTask(node.codeTaskId)}
        >
          {node.retryFailedActionLabel ?? "실패 작업 다시 실행"}
        </button>
      ) : null}
      <ExecutionFlowSteps
        steps={node.executionFlowSteps}
        onCopyCursorPrompt={
          onCopyCursorPrompt ? () => onCopyCursorPrompt(node.codeTaskId) : undefined
        }
      />
      {showInlineExecution && inlineExecution ? (
        <CodeTaskInlineExecutionDetailBlock detail={inlineExecution} />
      ) : null}
    </div>
  );
}

function FlatCodeTaskListItem({
  node,
  codeAgentProgress,
  onSelect,
  onToggleChecked,
  onCopyCursorPrompt,
  onRetryFailedCodeTask,
}: {
  readonly node: ImplementationCodeTaskTreeNode;
  readonly codeAgentProgress?: CodeAgentExecutionProgressView;
  readonly onSelect: (parentTaskId: string, codeTaskId: string) => void;
  readonly onToggleChecked?: (codeTaskId: string, checked: boolean) => void;
  readonly onCopyCursorPrompt?: (codeTaskId: string) => void;
  readonly onRetryFailedCodeTask?: (codeTaskId: string) => void;
}) {
  const itemClass = [styles.taskTreeCodeTaskItem, styles.taskTreeItem].join(" ");

  const statusLabel = node.boardState.statusLabel || node.metaLines.find((line) => line.label === "상태")?.value;
  const progressLabel =
    node.boardState.progressLabel || node.metaLines.find((line) => line.label === "진행")?.value;
  const headerMeta = [
    statusLabel ? `상태: ${statusLabel}` : null,
    progressLabel ? `진행: ${progressLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const userCanSelectCheckbox =
    node.checkboxDisabled !== true && node.boardState.checkboxDisabled !== true;

  return (
    <div
      className={itemClass}
      data-testid={`implementation-code-task-tree-item-${node.codeTaskId}`}
      data-selected={node.isSelected ? "true" : "false"}
    >
      <div className={styles.taskTreeHeaderRow}>
        <label className={styles.taskTreeCheckboxLabel}>
          <input
            type="checkbox"
            className={styles.taskTreeCheckbox}
            checked={node.isChecked}
            disabled={!userCanSelectCheckbox}
            aria-label={`${node.title} CodeTask 선택`}
            data-testid={`implementation-code-task-check-${node.codeTaskId}`}
            data-waiting={userCanSelectCheckbox ? "true" : "false"}
            onChange={(event) => {
              event.stopPropagation();
              const nextChecked = event.target.checked;
              if (!userCanSelectCheckbox && nextChecked) return;
              onToggleChecked?.(node.codeTaskId, nextChecked);
            }}
            onClick={(event) => event.stopPropagation()}
          />
        </label>
        <button
          type="button"
          className={styles.taskTreeCodeTaskHeader}
          onClick={() => onSelect(node.parentTaskId, node.codeTaskId)}
        >
          <span className={styles.taskTreeTitle}>{node.title}</span>
          <span className={styles.taskTreeCollapsedMeta}>
            {headerMeta || node.collapsedSummary}
          </span>
        </button>
      </div>
      {node.pollStatusLabel ? (
        <div
          className={styles.taskTreePollStatus}
          data-testid={`implementation-code-task-poll-status-${node.codeTaskId}`}
        >
          {node.pollStatusLabel}
        </div>
      ) : null}
      {node.isSelected ? (
        <CodeTaskSelectedDetail
          node={node}
          codeAgentProgress={codeAgentProgress}
          onCopyCursorPrompt={onCopyCursorPrompt}
          onRetryFailedCodeTask={onRetryFailedCodeTask}
        />
      ) : null}
    </div>
  );
}

export function ImplementationExecutionBoardTaskTree({
  nodes,
  selectedCodeTaskId,
  allChecked,
  selectAllIndeterminate,
  onSelectCodeTask,
  onToggleSelectAll,
  onToggleCodeTaskChecked,
  onCopyCodeTaskCursorPrompt,
  onRetryFailedCodeTask,
  onCopyDeveloperPromptsFromHeader,
  developerPromptHeaderCopyDisabled,
  selectedCodeTaskCount,
  selectableCodeTaskCount,
  integrationReadyCount,
  waitingCodeTaskIds,
  codeAgentProgress,
}: {
  readonly nodes: readonly ImplementationCodeTaskTreeNode[];
  readonly selectedCodeTaskId?: string | null;
  readonly codeAgentProgress?: CodeAgentExecutionProgressView;
  readonly allChecked?: boolean;
  readonly selectAllIndeterminate?: boolean;
  readonly onSelectCodeTask?: (parentTaskId: string, codeTaskId: string) => void;
  readonly onToggleSelectAll?: (checked: boolean) => void;
  readonly onToggleCodeTaskChecked?: (codeTaskId: string, checked: boolean) => void;
  readonly onCopyCodeTaskCursorPrompt?: (codeTaskId: string) => void;
  readonly onRetryFailedCodeTask?: (codeTaskId: string) => void;
  readonly onCopyDeveloperPromptsFromHeader?: () => void;
  readonly developerPromptHeaderCopyDisabled?: boolean;
  readonly selectedCodeTaskCount?: number;
  readonly selectableCodeTaskCount?: number;
  readonly integrationReadyCount?: number;
  readonly waitingCodeTaskIds?: readonly string[] | null;
}) {
  const codeTaskCount = nodes.length;
  const waitingCount = waitingCodeTaskIds?.length ?? 0;
  const selectedCount =
    selectedCodeTaskCount ?? nodes.filter((node) => node.isChecked).length;
  const runnableCount = selectableCodeTaskCount ?? codeTaskCount;
  const integrationReady = integrationReadyCount ?? 0;
  const selectAllInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllInputRef.current) {
      selectAllInputRef.current.indeterminate = Boolean(selectAllIndeterminate);
    }
  }, [selectAllIndeterminate, allChecked]);

  const summaryText = `CodeTask ${codeTaskCount}개 · 실행 가능 ${runnableCount}개 · 선택됨 ${selectedCount}개${
    integrationReady > 0 ? ` · 통합 가능 ${integrationReady}개` : ""
  }`;

  return (
    <div className={styles.taskTreeList} data-testid="implementation-task-tree">
      <div className={styles.taskTreeSummaryRow} data-testid="implementation-task-tree-summary">
        <span className={styles.taskTreeSelectAllMeta}>{summaryText}</span>
      </div>
      <div className={styles.taskTreeSelectAllRow}>
        <label className={styles.taskTreeSelectAllLabel}>
          <input
            ref={selectAllInputRef}
            type="checkbox"
            className={styles.taskTreeCheckbox}
            checked={Boolean(allChecked)}
            disabled={waitingCount === 0}
            data-testid="implementation-task-select-all"
            data-indeterminate={selectAllIndeterminate ? "true" : "false"}
            onChange={(event) => onToggleSelectAll?.(event.target.checked)}
          />
          <span>선택</span>
          {onCopyDeveloperPromptsFromHeader && codeTaskCount > 0 ? (
            <button
              type="button"
              className={styles.taskTreeCopyPromptButton}
              aria-label="선택 CodeTask 개발 프롬프트 복사"
              title="선택 CodeTask 2단계 개발 프롬프트 복사"
              data-testid="implementation-copy-developer-prompts-from-header"
              disabled={developerPromptHeaderCopyDisabled === true}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onCopyDeveloperPromptsFromHeader();
              }}
            >
              <CodeTaskCursorPromptCopyIcon size={13} />
            </button>
          ) : null}
        </label>
      </div>
      {nodes.map((node) => (
        <FlatCodeTaskListItem
          key={node.codeTaskId}
          node={{
            ...node,
            isSelected: selectedCodeTaskId === node.codeTaskId || node.isSelected,
          }}
          codeAgentProgress={codeAgentProgress}
          onSelect={(parentTaskId, codeTaskId) => onSelectCodeTask?.(parentTaskId, codeTaskId)}
          onToggleChecked={onToggleCodeTaskChecked}
          onCopyCursorPrompt={onCopyCodeTaskCursorPrompt}
          onRetryFailedCodeTask={onRetryFailedCodeTask}
        />
      ))}
    </div>
  );
}
