"use client";

import type { ChunkFilter } from "./utils";
import styles from "./chunkReview.module.css";

interface ChunkFilterBarProps {
  search: string;
  filter: ChunkFilter;
  sectionFilter: string | null;
  onChangeSearch: (value: string) => void;
  onChangeFilter: (filter: ChunkFilter) => void;
  onClearSectionFilter: () => void;
}

const FILTER_OPTIONS: Array<{ id: ChunkFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "needs-review", label: "검토 필요" },
  { id: "edited", label: "수정됨" },
  { id: "noise", label: "노이즈 의심" },
  { id: "long", label: "긴 청크" },
  { id: "short", label: "짧은 청크" },
];

export default function ChunkFilterBar({
  search,
  filter,
  sectionFilter,
  onChangeSearch,
  onChangeFilter,
  onClearSectionFilter,
}: ChunkFilterBarProps) {
  return (
    <div className={styles.stack8}>
      <input
        value={search}
        onChange={(e) => onChangeSearch(e.target.value)}
        placeholder="청크 검색 (ID/섹션/텍스트)"
        className={styles.input}
      />
      {sectionFilter && (
        <div className={styles.helperRow}>
          <span>구조 필터: {sectionFilter}</span>
          <button type="button" onClick={onClearSectionFilter} className={styles.actionBtn}>
            해제
          </button>
        </div>
      )}
      <div className={styles.chipRow}>
        {FILTER_OPTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeFilter(item.id)}
            className={`${styles.chip} ${filter === item.id ? styles.chipActive : ""}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
