"use client";

import styles from "@/components/workspace/workspaceParticipantButton.module.css";

export function WorkspaceParticipantButton({
  count,
  onOpen,
  testId = "workspace-participants-open",
}: {
  readonly count: number;
  readonly onOpen: () => void;
  readonly testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onOpen}
      aria-label={`참여 멤버 보기 (${Math.max(0, count)}명)`}
      title="참여 멤버 보기"
      className={styles.wrap}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M16 11a4 4 0 1 0-8 0" />
        <path d="M4 20c1.2-3.2 4.3-5 8-5s6.8 1.8 8 5" />
        <path d="M16.5 7.5a3 3 0 1 0 0-6" />
      </svg>
      {count > 0 ? (
        <span aria-hidden className={styles.badge}>
          {Math.max(0, count)}
        </span>
      ) : null}
    </button>
  );
}
