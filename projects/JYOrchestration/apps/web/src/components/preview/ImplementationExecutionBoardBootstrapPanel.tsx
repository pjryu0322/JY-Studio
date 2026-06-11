"use client";

import styles from "@/components/preview/implementationExecutionBoardPanel.module.css";

export function ImplementationExecutionBoardBootstrapPanel(props: {
  readonly body: string;
  readonly actionLabels: readonly string[];
  readonly onAction: (label: string) => void;
}): import("react").ReactNode {
  const body = String(props.body ?? "").trim();
  const actions = props.actionLabels.map((l) => String(l ?? "").trim()).filter(Boolean);

  return (
    <section
      className={styles.root}
      data-testid="implementation-execution-board-bootstrap"
      style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      <header className={styles.header}>
        <div className={styles.headerTitle}>구현 작업 보드</div>
        <div className={styles.summarySecondary}>작업목록이 준비되면 아래에서 CodeTask를 실행할 수 있습니다.</div>
      </header>
      {body ? (
        <div className={styles.summaryCard}>
          <pre
            className={styles.bootstrapBody}
            data-testid="implementation-bootstrap-body"
          >
            {body}
          </pre>
        </div>
      ) : null}
      {actions.length > 0 ? (
        <div className={styles.bootstrapActions} data-testid="implementation-bootstrap-actions">
          {actions.map((label) => (
            <button
              key={label}
              type="button"
              className={styles.bootstrapActionButton}
              onClick={() => props.onAction(label)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
