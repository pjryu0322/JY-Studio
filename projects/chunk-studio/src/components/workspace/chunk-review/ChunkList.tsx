"use client";

import type { ChunkDTO } from "@/types/job";
import { mapChunkToPage } from "@/lib/analysis/chunkMappingService";
import styles from "./chunkReview.module.css";

interface ChunkListItem {
  chunk: ChunkDTO;
  index: number;
  status: string;
}

interface ChunkListProps {
  items: ChunkListItem[];
  selectedChunkId: string | null;
  emptyMessage: string;
  onSelectChunk: (chunk: ChunkDTO) => void;
}

export default function ChunkList({
  items,
  selectedChunkId,
  emptyMessage,
  onSelectChunk,
}: ChunkListProps) {
  return (
    <div className={styles.listWrap}>
      {items.map(({ chunk, index, status }) => {
        const { pageStart: startPage, pageEnd: endPage } = mapChunkToPage(chunk);
        const isSelected = selectedChunkId === chunk.meta.chunkId;
        return (
          <button
            key={chunk.meta.chunkId || `chunk-${index}`}
            type="button"
            onClick={() => onSelectChunk(chunk)}
            className={`${styles.listRow} ${isSelected ? styles.listRowSelected : ""}`}
          >
            <div className={styles.rowHeader}>
              <strong className={styles.rowTitle}>
                #{index + 1} {chunk.meta.sectionTitle || chunk.meta.sectionPath.at(-1) || "Untitled"}
              </strong>
              <StatusBadge status={status} />
            </div>
            <div className={styles.rowMeta}>
              p.{startPage ?? "-"}~{endPage ?? "-"} /{" "}
              {(chunk.meta.sectionPath.join(" > ") || "Unsectioned").slice(0, 44)}
            </div>
            <div className={styles.rowPreview}>
              {chunk.text.slice(0, 90)}
              {chunk.text.length > 90 ? "..." : ""}
            </div>
            {status === "짧은 청크" && (
              <div className={styles.recommendHint}>추천: 인접 청크와 병합 검토</div>
            )}
          </button>
        );
      })}
      {items.length === 0 && <div className={styles.emptyText}>{emptyMessage}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "정상"
      ? { color: "#166534", bg: "#dcfce7", border: "#86efac" }
      : status === "검토 필요"
        ? { color: "#92400e", bg: "#fef3c7", border: "#fcd34d" }
        : status === "수정됨"
          ? { color: "#1d4ed8", bg: "#dbeafe", border: "#93c5fd" }
          : { color: "#b91c1c", bg: "#fee2e2", border: "#fca5a5" };
  return (
    <span
      className={styles.statusBadge}
      style={{ color: tone.color, background: tone.bg, border: `1px solid ${tone.border}` }}
    >
      {status}
    </span>
  );
}
