"use client";

import { useEffect, useMemo, useState } from "react";
import type { ImplementationTaskTreeNode } from "@/lib/prototype/implementationExecutionBoardPanelView";
import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

export function ImplementationExecutionBoardTaskTree({
  nodes,
}: {
  readonly nodes: readonly ImplementationTaskTreeNode[];
}) {
  const defaultExpanded = useMemo(
    () => new Set(nodes.map((node) => node.taskId)),
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
      {nodes.map((node) => {
        const isOpen = expanded.has(node.taskId);
        return (
          <div
            key={node.taskId}
            className={node.isActive ? `${styles.taskTreeItem} ${styles.taskTreeItemActive}` : styles.taskTreeItem}
            data-testid={`implementation-task-tree-item-${node.taskId}`}
            data-expanded={isOpen ? "true" : "false"}
          >
            <button
              type="button"
              className={styles.taskTreeHeader}
              aria-expanded={isOpen}
              onClick={() => toggle(node.taskId)}
            >
              <span className={styles.taskTreeToggle}>{isOpen ? "▼" : "▶"}</span>
              <span className={styles.taskTreeTitle}>
                {node.taskId} {node.title}
              </span>
              {!isOpen ? <span className={styles.taskTreeCollapsedMeta}>{node.collapsedSummary}</span> : null}
            </button>
            {isOpen ? (
              <div className={styles.taskTreeChildren}>
                {node.childSteps.map((step) => (
                  <div key={`${node.taskId}-${step.roleLabel}`} className={styles.taskTreeChildLine}>
                    {step.statusLabel}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
