"use client";

import { useEffect, useMemo, useState } from "react";
import type { ImplementationTaskTreeNode } from "@/lib/prototype/implementationExecutionBoardPanelView";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

export function ImplementationExecutionBoardTaskTree({
  nodes,
  selectedTaskId,
  allChecked,
  onSelectTask,
  onToggleTaskChecked,
  onToggleSelectAll,
  onRestartTask,
  onStopTask,
}: {
  readonly nodes: readonly ImplementationTaskTreeNode[];
  readonly selectedTaskId?: string | null;
  readonly allChecked?: boolean;
  readonly onSelectTask?: (taskId: string) => void;
  readonly onToggleTaskChecked?: (taskId: string, checked: boolean) => void;
  readonly onToggleSelectAll?: (checked: boolean) => void;
  readonly onRestartTask?: (taskId: string) => void;
  readonly onStopTask?: (taskId: string) => void;
}) {
  const defaultExpanded = useMemo(
    () => new Set(nodes.filter((node) => node.defaultExpanded).map((node) => node.taskId)),
    [nodes],
  );

  const [expanded, setExpanded] = useState<Set<string>>(defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const toggle = (taskId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

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
          {nodes.filter((node) => node.isChecked).length}/{nodes.length}개 선택
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
                aria-label={`${node.taskId} 선택`}
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
                <span className={styles.taskTreeTitle}>
                  {node.taskId} {node.title}
                </span>
                {!isOpen ? <span className={styles.taskTreeCollapsedMeta}>{node.collapsedSummary}</span> : null}
              </button>
            </div>
            {node.dependencyLabel ? (
              <div className={styles.taskTreeDependencyLine}>{node.dependencyLabel}</div>
            ) : null}
            {isOpen ? (
              <div className={styles.taskTreeChildren}>
                {node.childSteps.map((step) => (
                  <div key={`${node.taskId}-${step.roleLabel}`} className={styles.taskTreeChildLine}>
                    {step.statusLabel}
                  </div>
                ))}
                {node.pollStatusLabel ? (
                  <div
                    className={styles.taskTreePollStatus}
                    data-testid={`implementation-task-poll-status-${node.taskId}`}
                  >
                    {node.pollStatusLabel}
                  </div>
                ) : null}
                {node.canRestart || node.canStop ? (
                  <div className={styles.taskTreeActionRow}>
                    {node.canRestart ? (
                      <button
                        type="button"
                        className={styles.taskTreeRestartButton}
                        data-testid={`implementation-task-restart-${node.taskId}`}
                        onClick={() => onRestartTask?.(node.taskId)}
                      >
                        {node.needsReworkRegistration ? "재작업 후 실행" : "이 Task 실행"}
                      </button>
                    ) : null}
                    {node.canStop ? (
                      <button
                        type="button"
                        className={styles.taskTreeStopButton}
                        data-testid={`implementation-task-stop-${node.taskId}`}
                        onClick={() => onStopTask?.(node.taskId)}
                      >
                        Task 중지
                      </button>
                    ) : null}
                  </div>
                ) : node.restartBlockedReason ? (
                  <div className={styles.taskTreeRestartHint}>{node.restartBlockedReason}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
