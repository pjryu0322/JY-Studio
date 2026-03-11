"use client";

import type { ChunkDTO } from "@/types/job";
import { mapChunkToPage } from "@/lib/analysis/chunkMappingService";
import { buildMergedPreview } from "./utils";
import styles from "./chunkReview.module.css";

interface SelectedChunkDetailProps {
  chunk: ChunkDTO | null;
  status: string | null;
  mergeTarget: ChunkDTO | null;
  loadingMessage: string | null;
  onJumpToPdf: () => void;
  onApplyRecommendedMerge: () => void;
}

export default function SelectedChunkDetail({
  chunk,
  status,
  mergeTarget,
  loadingMessage,
  onJumpToPdf,
  onApplyRecommendedMerge,
}: SelectedChunkDetailProps) {
  return (
    <section className={`${styles.card} ${styles.mt10}`}>
      <strong className={styles.cardTitle}>B. Selected Chunk Detail</strong>
      {!chunk ? (
        <div className={styles.emptyText}>
          {loadingMessage ?? "선택된 청크가 없습니다."}
        </div>
      ) : (
        <div className={styles.detailGrid}>
          <Row label="chunk id" value={chunk.meta.chunkId} />
          <Row
            label="page range"
            value={`p.${mapChunkToPage(chunk).pageStart ?? "-"} ~ p.${mapChunkToPage(chunk).pageEnd ?? "-"}`}
          />
          <Row label="structure path" value={chunk.meta.sectionPath.join(" > ") || "Unsectioned"} />
          <Row label="section title" value={chunk.meta.sectionTitle ?? "-"} />
          <Row label="status" value={status ?? "정상"} />
          <div className={styles.contentBox}>
            {chunk.text.slice(0, 560)}
            {chunk.text.length > 560 ? "..." : ""}
          </div>
          {status === "짧은 청크" && mergeTarget && (
            <div className={styles.recommendBox}>
              <div className={styles.recommendTitle}>추천 청킹(최적안)</div>
              <div className={styles.recommendText}>
                현재 청크가 짧아 인접 청크 <strong>{mergeTarget.meta.chunkId}</strong> 와 병합하는 것을
                권장합니다.
              </div>
              <div className={styles.recommendPreview}>
                {buildMergedPreview(chunk, mergeTarget)}
              </div>
              <button type="button" onClick={onApplyRecommendedMerge} className={styles.actionBtn} style={{ marginTop: 8 }}>
                추천 병합안 적용
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onJumpToPdf}
            className={styles.actionBtn}
            style={{ justifySelf: "start" }}
          >
            PDF 위치로 이동
          </button>
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.kvRow}>
      <span className={styles.kvLabel}>{label}</span>
      <span className={styles.kvValue}>{value}</span>
    </div>
  );
}
