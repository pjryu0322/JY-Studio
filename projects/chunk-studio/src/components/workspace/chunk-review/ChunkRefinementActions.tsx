"use client";

import styles from "./chunkReview.module.css";

interface ChunkRefinementActionsProps {
  canEdit: boolean;
  labelValue: string;
  noteValue: string;
  modifiedStateText: string;
  onMerge: () => void;
  onSplit: () => void;
  onToggleExclude: () => void;
  onChangeLabel: (value: string) => void;
  onBlurLabel: () => void;
  onChangeNote: (value: string) => void;
  onBlurNote: () => void;
}

export default function ChunkRefinementActions({
  canEdit,
  labelValue,
  noteValue,
  modifiedStateText,
  onMerge,
  onSplit,
  onToggleExclude,
  onChangeLabel,
  onBlurLabel,
  onChangeNote,
  onBlurNote,
}: ChunkRefinementActionsProps) {
  return (
    <section className={`${styles.card} ${styles.mt10}`}>
      <strong className={styles.cardTitle}>C. Refinement Actions</strong>
      {!canEdit ? (
        <div className={styles.emptyText}>청크를 먼저 선택하세요.</div>
      ) : (
        <div className={styles.stack8}>
          <div className={styles.chipRow}>
            <button type="button" onClick={onMerge} className={styles.actionBtn}>
              병합
            </button>
            <button type="button" onClick={onSplit} className={styles.actionBtn}>
              분할
            </button>
            <button type="button" onClick={onToggleExclude} className={styles.actionBtn}>
              제외
            </button>
          </div>
          <label style={{ fontSize: 12, color: "#334155" }}>
            레이블 수정
            <input
              value={labelValue}
              onChange={(e) => onChangeLabel(e.target.value)}
              onBlur={onBlurLabel}
              className={styles.input}
            />
          </label>
          <label style={{ fontSize: 12, color: "#334155" }}>
            검토 메모
            <textarea
              value={noteValue}
              onChange={(e) => onChangeNote(e.target.value)}
              onBlur={onBlurNote}
              rows={3}
              className={styles.textarea}
            />
          </label>
          <div className={styles.rowPreview}>{modifiedStateText}</div>
        </div>
      )}
    </section>
  );
}
