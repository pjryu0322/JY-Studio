"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ImplementationCodeTaskTreeNode,
  ImplementationProcessTaskTreeNode,
  ImplementationTaskTreeMetaLine,
} from "@/lib/prototype/implementationTaskTreeView";
import type { CodeTaskExecutionFlowStepVm } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import type { CodeAgentExecutionProgressView } from "@/lib/prototype/codeAgentExecutionProgressView";
import { buildCodeTaskInlineExecutionDetail } from "@/lib/prototype/implementationCodeTaskInlineExecution";
import { CodeTaskInlineExecutionDetailBlock } from "@/components/preview/CodeTaskInlineExecutionDetail";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

function TaskTreeMetaBlock({ lines }: { readonly lines: readonly ImplementationTaskTreeMetaLine[] }) {
  if (!lines.length) return null;
  return (
    <div className={styles.taskTreeMetaBlock} data-testid="implementation-task-tree-meta">
      {lines.map((line) => (
        <div key={`${line.label}-${line.value}`} className={styles.taskTreeMetaLine}>
          <span className={styles.taskTreeMetaKey}>{line.label}</span>
          <span className={styles.taskTreeMetaValue}>{line.value}</span>
        </div>
      ))}
    </div>
  );
}

function ExecutionFlowSteps({ steps }: { readonly steps: readonly CodeTaskExecutionFlowStepVm[] }) {
  if (!steps.length) return null;
  return (
    <div className={styles.taskTreeFlowBlock} data-testid="implementation-code-task-flow">
      <div className={styles.taskTreeFlowTitle}>실행 흐름</div>
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
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CodeTaskTreeItem({
  node,
  depth,
  codeAgentProgress,
  onCancelTaskCursorPolling,
  onResumeStatusCheck,
  onSelect,
  onToggleChecked,
  onRunSingle,
}: {
  readonly node: ImplementationCodeTaskTreeNode;
  readonly depth: number;
  readonly codeAgentProgress?: CodeAgentExecutionProgressView;
  readonly onCancelTaskCursorPolling?: () => void;
  readonly onResumeStatusCheck?: () => void;
  readonly onSelect: (parentTaskId: string, codeTaskId: string) => void;
  readonly onToggleChecked?: (codeTaskId: string, checked: boolean) => void;
  readonly onRunSingle?: (codeTaskId: string) => void;
}) {
  const inlineExecution = codeAgentProgress
    ? buildCodeTaskInlineExecutionDetail({
        progress: codeAgentProgress,
        parentTaskId: node.parentTaskId,
        isSelected: node.isSelected,
        executionFlowSteps: node.executionFlowSteps,
      })
    : undefined;
  const showInlineActions =
    inlineExecution?.canCancelCloudAgentPolling || inlineExecution?.canResumeStatusCheck;
  const itemClass = [
    styles.taskTreeCodeTaskItem,
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
      style={{ marginInlineStart: `${depth * 14}px` }}
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
      {node.isSelected ? (
        <div className={styles.taskTreeCodeTaskDetail}>
          <TaskTreeMetaBlock lines={node.metaLines} />
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
          <ExecutionFlowSteps steps={node.executionFlowSteps} />
          {showInlineActions && inlineExecution ? (
            <CodeTaskInlineExecutionDetailBlock
              detail={inlineExecution}
              onCancelPolling={onCancelTaskCursorPolling}
              onResumeStatusCheck={onResumeStatusCheck}
            />
          ) : null}
          {node.canRunSingle && onRunSingle ? (
            <div className={styles.taskTreeActionRow}>
              <button
                type="button"
                className={styles.taskTreeRestartButton}
                data-testid={`implementation-code-task-run-${node.codeTaskId}`}
                onClick={() => onRunSingle(node.codeTaskId)}
              >
                이 CodeTask 실행
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ImplementationExecutionBoardTaskTree({
  nodes,
  selectedTaskId,
  selectedCodeTaskId,
  allChecked,
  onSelectTask,
  onSelectCodeTask,
  onToggleTaskChecked,
  onToggleSelectAll,
  onToggleCodeTaskChecked,
  onRunSingleCodeTask,
  selectedCodeTaskCount,
  onRestartTask,
  onStopTask,
  codeAgentProgress,
  onCancelTaskCursorPolling,
  onResumeStatusCheck,
}: {
  readonly nodes: readonly ImplementationProcessTaskTreeNode[];
  readonly selectedTaskId?: string | null;
  readonly selectedCodeTaskId?: string | null;
  readonly codeAgentProgress?: CodeAgentExecutionProgressView;
  readonly onCancelTaskCursorPolling?: () => void;
  readonly onResumeStatusCheck?: () => void;
  readonly allChecked?: boolean;
  readonly onSelectTask?: (taskId: string) => void;
  readonly onSelectCodeTask?: (parentTaskId: string, codeTaskId: string) => void;
  readonly onToggleTaskChecked?: (taskId: string, checked: boolean) => void;
  readonly onToggleSelectAll?: (checked: boolean) => void;
  readonly onToggleCodeTaskChecked?: (codeTaskId: string, checked: boolean) => void;
  readonly onRunSingleCodeTask?: (codeTaskId: string) => void;
  readonly selectedCodeTaskCount?: number;
  readonly onRestartTask?: (taskId: string) => void;
  readonly onStopTask?: (taskId: string) => void;
}) {
  const defaultExpanded = useMemo(
    () => new Set(nodes.filter((node) => node.defaultExpanded).map((node) => node.taskId)),
    [nodes],
  );

  const [expanded, setExpanded] = useState<Set<string>>(defaultExpanded);

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of defaultExpanded) next.add(id);
      if (selectedTaskId) next.add(selectedTaskId);
      return next;
    });
  }, [defaultExpanded, selectedTaskId]);

  const toggle = (taskId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const processCount = nodes.length;
  const codeTaskCount = nodes.reduce((sum, node) => sum + node.codeTasks.length, 0);

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
        </label>
        <span className={styles.taskTreeSelectAllMeta}>
          Process Task {processCount}개 · CodeTask {codeTaskCount}개 · 선택됨{" "}
          {selectedCodeTaskCount ?? nodes.reduce((n, node) => n + node.codeTasks.filter((ct) => ct.isChecked).length, 0)}개
        </span>
      </div>
      {nodes.map((node) => {
        const isOpen = expanded.has(node.taskId);
        const isSelected = selectedTaskId === node.taskId || node.isSelected;
        const itemClassName = [
          styles.taskTreeItem,
          node.isActive ? styles.taskTreeItemActive : "",
          isSelected ? styles.taskTreeItemSelected : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            key={node.taskId}
            className={itemClassName}
            data-testid={`implementation-task-tree-item-${node.taskId}`}
            data-expanded={isOpen ? "true" : "false"}
            data-selected={isSelected ? "true" : "false"}
            data-checked={node.isChecked ? "true" : "false"}
            style={{ marginInlineStart: `${node.treeDepth * 14}px` }}
          >
            <div className={styles.taskTreeHeaderRow}>
              <input
                type="checkbox"
                className={styles.taskTreeCheckbox}
                checked={node.isChecked}
                aria-label={`${node.title} 선택`}
                data-testid={`implementation-task-check-${node.taskId}`}
                onChange={(event) => onToggleTaskChecked?.(node.taskId, event.target.checked)}
              />
              <button
                type="button"
                className={styles.taskTreeToggleButton}
                aria-expanded={isOpen}
                aria-label={isOpen ? "접기" : "펼치기"}
                onClick={() => toggle(node.taskId)}
              >
                {isOpen ? "▼" : "▶"}
              </button>
              <button
                type="button"
                className={styles.taskTreeHeader}
                aria-pressed={isSelected}
                onClick={() => onSelectTask?.(node.taskId)}
              >
                <span className={styles.taskTreeTitle} data-testid={`implementation-process-task-title-${node.taskId}`}>
                  {node.title}
                </span>
                {!isOpen ? <span className={styles.taskTreeCollapsedMeta}>{node.collapsedSummary}</span> : null}
              </button>
            </div>
            {node.dependencyLabel ? (
              <div className={styles.taskTreeDependencyLine}>{node.dependencyLabel}</div>
            ) : null}
            {isOpen ? (
              <div className={styles.taskTreeChildren}>
                {node.codeTasks.length ? (
                  <div className={styles.taskTreeCodeTaskList}>
                    {node.codeTasks.map((codeTask) => (
                      <CodeTaskTreeItem
                        key={codeTask.codeTaskId}
                        node={{
                          ...codeTask,
                          isSelected:
                            selectedCodeTaskId === codeTask.codeTaskId ||
                            (isSelected && !selectedCodeTaskId && codeTask === node.codeTasks[0]),
                        }}
                        depth={1}
                        codeAgentProgress={codeAgentProgress}
                        onCancelTaskCursorPolling={onCancelTaskCursorPolling}
                        onResumeStatusCheck={onResumeStatusCheck}
                        onSelect={(parentTaskId, codeTaskId) => {
                          onSelectTask?.(parentTaskId);
                          onSelectCodeTask?.(parentTaskId, codeTaskId);
                        }}
                        onToggleChecked={onToggleCodeTaskChecked}
                        onRunSingle={onRunSingleCodeTask}
                      />
                    ))}
                  </div>
                ) : null}
                {node.pollStatusLabel ? (
                  <div
                    className={styles.taskTreePollStatus}
                    data-testid={`implementation-task-poll-status-${node.taskId}`}
                  >
                    {node.pollStatusLabel}
                  </div>
                ) : null}
                {node.canStop || node.canResumeStatusCheck ? (
                  <div className={styles.taskTreeActionRow}>
                    {node.canStop ? (
                      <button
                        type="button"
                        className={styles.taskTreeStopButton}
                        data-testid={`implementation-task-stop-${node.taskId}`}
                        onClick={() => onStopTask?.(node.taskId)}
                      >
                        상태 확인 중단
                      </button>
                    ) : null}
                    {node.canResumeStatusCheck ? (
                      <button
                        type="button"
                        className={styles.taskTreeRestartButton}
                        data-testid={`implementation-task-resume-status-check-${node.taskId}`}
                        onClick={() => onResumeStatusCheck?.()}
                      >
                        상태 다시 확인
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
