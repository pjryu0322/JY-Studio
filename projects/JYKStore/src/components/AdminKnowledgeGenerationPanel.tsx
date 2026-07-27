"use client";

import { AdminWorkerZipGenerationCard } from "@/components/AdminWorkerZipGenerationCard";

/**
 * Workbench — 지식데이터 생성 또는 품질점검 영역.
 * 상태/폴링은 AdminWorkerZipGenerationCard가 소유한다.
 */
export function AdminKnowledgeGenerationPanel({
  packId,
  onReviewDetailRefresh,
  onPhaseChange,
  qualityRefreshRequestKey = 0,
  qualityResultsRevealKey = 0,
  preferQualitySection = false,
  workbenchMode = "all",
  autoStartGeneration = false,
  onAutoStartGenerationConsumed,
  onGoQuality,
  onGoCorrection,
  onGoProviderReview,
}: {
  readonly packId: string;
  readonly onReviewDetailRefresh?: () => void | Promise<void>;
  readonly onPhaseChange?: (
    phase:
      | "NONE"
      | "REQUESTED"
      | "ACCEPTED"
      | "REJECTED"
      | "PROCESSING"
      | "COMPLETED"
      | "FAILED",
  ) => void;
  readonly qualityRefreshRequestKey?: number;
  readonly qualityResultsRevealKey?: number;
  readonly preferQualitySection?: boolean;
  readonly workbenchMode?: "generation" | "quality" | "all";
  /** When true, start Worker generation once the request is ready. */
  readonly autoStartGeneration?: boolean;
  readonly onAutoStartGenerationConsumed?: () => void;
  readonly onGoQuality?: () => void;
  readonly onGoCorrection?: () => void;
  readonly onGoProviderReview?: () => void;
}) {
  return (
    <AdminWorkerZipGenerationCard
      packId={packId}
      onReviewDetailRefresh={onReviewDetailRefresh}
      onPhaseChange={onPhaseChange}
      qualityRefreshRequestKey={qualityRefreshRequestKey}
      qualityResultsRevealKey={qualityResultsRevealKey}
      preferQualitySection={preferQualitySection}
      workbenchMode={workbenchMode}
      autoStartGeneration={autoStartGeneration}
      onAutoStartGenerationConsumed={onAutoStartGenerationConsumed}
      onGoQuality={onGoQuality}
      onGoCorrection={onGoCorrection}
      onGoProviderReview={onGoProviderReview}
    />
  );
}
