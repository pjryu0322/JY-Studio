import type { FeaturePlanningPromptLogStatus, FeaturePlanningPromptPurpose } from "@/lib/debug/featurePlanningPromptPurpose";

export type PromptTimelineChannel = "openai" | "cursor";

/** 기능정리 v2 프롬프트 압축·토큰 추정(로깅 전용) */
export type FeaturePlanningPromptMetricsV1 = {
  readonly tokenEstimateIn?: number;
  readonly tokenEstimateOut?: number;
  readonly compressedContextSize?: number;
  readonly topic?: string;
  readonly memoryStateSnapshot?: string;
};

export type PromptTimelineEntry = {
  readonly id: string;
  readonly at: string;
  readonly channel: PromptTimelineChannel;
  readonly label: string;
  readonly model?: string | null;
  readonly outbound: string;
  readonly inbound: string;
  /** 기능정리 등 세부 목적 */
  readonly purpose?: FeaturePlanningPromptPurpose;
  readonly status?: FeaturePlanningPromptLogStatus;
  readonly errorMessage?: string | null;
  /** 파싱된 JSON 일부(미리보기) */
  readonly parsedJsonPreview?: string | null;
  readonly promptMetrics?: FeaturePlanningPromptMetricsV1 | null;
};
