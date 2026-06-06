"use client";

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
                  aria-label="현재 CodeTask 개발 프롬프트 복사"
                  title="현재 CodeTask 개발 프롬프트 복사 (2단계 · Cursor 전달용)"
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
}: {
  readonly node: ImplementationCodeTaskTreeNode;
  readonly codeAgentProgress?: CodeAgentExecutionProgressView;
  readonly onCopyCursorPrompt?: (codeTaskId: string) => void;
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
      {node.githubVerifyTechnicalLines?.length ? (
        <div
          className={styles.taskTreeFailureBlock}
          data-testid={`code-task-github-verify-detail-${node.codeTaskId}`}
        >
          {node.githubVerifyTechnicalLines.map((line) => (
            <div key={`${line.label}-${line.value}`} className={styles.taskTreeMetaLine}>
              <span className={styles.taskTreeMetaKey}>{line.label}</span>
              <span className={styles.taskTreeMetaValue}>{line.value}</span>
            </div>
          ))}
        </div>
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
}: {
  readonly node: ImplementationCodeTaskTreeNode;
  readonly codeAgentProgress?: CodeAgentExecutionProgressView;
  readonly onSelect: (parentTaskId: string, codeTaskId: string) => void;
  readonly onToggleChecked?: (codeTaskId: string, checked: boolean) => void;
  readonly onCopyCursorPrompt?: (codeTaskId: string) => void;
}) {
  const itemClass = [
    styles.taskTreeCodeTaskItem,
    styles.taskTreeItem,
    node.isActive ? styles.taskTreeItemActive : "",
    node.isSelected ? styles.taskTreeItemSelected : "",
  ]
    .filter(Boolean)
    .join(" ");

  const statusLabel = node.metaLines.find((line) => line.label === "상태")?.value;
  const progressLabel = node.metaLines.find((line) => line.label === "진행")?.value;
  const headerMeta = [
    statusLabel ? `상태: ${statusLabel}` : null,
    progressLabel ? `진행: ${progressLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={itemClass}
      data-testid={`implementation-code-task-tree-item-${node.codeTaskId}`}
      data-selected={node.isSelected ? "true" : "false"}
    >
      <div className={styles.taskTreeHeaderRow}>
        <input
          type="checkbox"
          className={styles.taskTreeCheckbox}
          checked={node.isChecked}
          aria-label={`${node.title} CodeTask 선택`}
          data-testid={`implementation-code-task-check-${node.codeTaskId}`}
          onChange={(event) => onToggleChecked?.(node.codeTaskId, event.target.checked)}
        />
        <button
          type="button"
          className={styles.taskTreeCodeTaskHeader}
          aria-pressed={node.isSelected}
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
        />
      ) : null}
    </div>
  );
}

export function ImplementationExecutionBoardTaskTree({
  nodes,
  selectedCodeTaskId,
  allChecked,
  onSelectCodeTask,
  onToggleSelectAll,
  onToggleCodeTaskChecked,
  onCopyCodeTaskCursorPrompt,
  onCopyAllCodeTaskCursorPrompts,
  selectedCodeTaskCount,
  codeAgentProgress,
}: {
  readonly nodes: readonly ImplementationCodeTaskTreeNode[];
  readonly selectedCodeTaskId?: string | null;
  readonly codeAgentProgress?: CodeAgentExecutionProgressView;
  readonly allChecked?: boolean;
  readonly onSelectCodeTask?: (parentTaskId: string, codeTaskId: string) => void;
  readonly onToggleSelectAll?: (checked: boolean) => void;
  readonly onToggleCodeTaskChecked?: (codeTaskId: string, checked: boolean) => void;
  readonly onCopyCodeTaskCursorPrompt?: (codeTaskId: string) => void;
  readonly onCopyAllCodeTaskCursorPrompts?: () => void;
  readonly selectedCodeTaskCount?: number;
}) {
  const codeTaskCount = nodes.length;
  const selectedCount =
    selectedCodeTaskCount ?? nodes.filter((node) => node.isChecked).length;

  return (
    <div className={styles.taskTreeList} data-testid="implementation-task-tree">
      <div className={styles.taskTreeSelectAllRow}>
        <label className={styles.taskTreeSelectAllLabel}>
          <input
            type="checkbox"
            className={styles.taskTreeCheckbox}
            checked={Boolean(allChecked)}
            data-testid="implementation-task-select-all"
            onChange={(event) => onToggleSelectAll?.(event.target.checked)}
          />
          <span>전체 선택</span>
          {onCopyAllCodeTaskCursorPrompts && codeTaskCount > 0 ? (
            <button
              type="button"
              className={styles.taskTreeCopyPromptButton}
              aria-label="계획 프롬프트 복사"
              title="CodeTask 1단계 계획 프롬프트 복사 (Cursor 실행용 아님)"
              data-testid="implementation-copy-all-planning-draft-prompts"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onCopyAllCodeTaskCursorPrompts();
              }}
            >
              <CodeTaskCursorPromptCopyIcon size={13} />
            </button>
          ) : null}
        </label>
        <span className={styles.taskTreeSelectAllMeta}>
          CodeTask {codeTaskCount}개 · 선택됨 {selectedCount}개
        </span>
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
        />
      ))}
    </div>
  );
}
