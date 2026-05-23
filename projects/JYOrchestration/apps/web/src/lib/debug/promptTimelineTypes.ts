import type { FeaturePlanningPromptLogStatus, FeaturePlanningPromptPurpose } from "@/lib/debug/featurePlanningPromptPurpose";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";

export type PromptTimelineChannel = "openai" | "cursor" | "platform";

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
  /**
   * Overlay Observability UI용 optional metadata.
   *
   * 존재할 때만 Overlay 탭이 의미 있는 내용을 보여준다. 누락된 과거 timeline은
   * UI가 empty state로 처리한다. **이 필드는 prompt/payload·라우팅에 영향을 주지
   * 않으며 read-only metadata다.**
   */
  readonly overlay?: ExtractedOverlayPromptTraceMetadata | null;
};
