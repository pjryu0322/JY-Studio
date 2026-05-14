/**
 * Harness Phase H1 — **Controlled Prompt Assembly Preview**의 type 정의.
 *
 * **read-only / dry-run only.** 이 타입의 어떤 값도 실제 prompt payload, OpenAI 호출,
 * Cursor execution, GitHub PR/merge, retrieval, provider 라우팅에 영향을 주지 않는다.
 *
 * Harness preview는 "기존 prompt payload를 표준 방식으로 조립한다면 어떤 prompt가
 * 만들어질지" 를 미리 확인하기 위한 진단 metadata다. 따라서 mode는 항상 `"dry_run"`.
 */

/**
 * Harness preview에서 사용하는 표준 section 타입.
 *
 * deterministic ordering(`harnessPromptSectionOrder`)을 통해 동일한 입력이면
 * 항상 동일한 순서로 정렬된다. system → role_contract → ... → output_format.
 */
export type HarnessPromptSectionType =
  | "system"
  | "role_contract"
  | "project_context"
  | "memory_context"
  | "knowledge_context"
  | "current_request"
  | "constraints"
  | "output_format"
  | "diagnostic";

/**
 * Harness preview의 overflow 위험도. **overlay budget의 `OverlayContextBudgetOverflowRisk`와
 * 의도적으로 동일한 union**으로 정의되어 UI label/tone 헬퍼(`overlayUiOverflowRiskLabel/Tone`)를
 * 재사용할 수 있도록 한다.
 *
 * 별도 type alias로 노출해 호출부의 의도를 명시(harness preview의 위험도).
 */
import type { OverlayContextBudgetOverflowRisk as _OverlayOverflowRisk } from "@/lib/overlay/overlayContextBudget";
export type HarnessPromptOverflowRisk = _OverlayOverflowRisk;

/**
 * Harness preview의 표준 노출 순서. deterministic ordering의 단일 출처.
 */
export const HARNESS_PROMPT_SECTION_ORDER: readonly HarnessPromptSectionType[] = [
  "system",
  "role_contract",
  "project_context",
  "memory_context",
  "knowledge_context",
  "current_request",
  "constraints",
  "output_format",
  "diagnostic",
];

/**
 * 사용자 친화 한국어 라벨 — **단일 출처**. builder의 section title과 UI adapter의 typeLabel이 모두 여기서 도출.
 */
export const HARNESS_PROMPT_SECTION_TITLE: Readonly<Record<HarnessPromptSectionType, string>> = {
  system: "시스템",
  role_contract: "역할 계약",
  project_context: "프로젝트 맥락",
  memory_context: "기억 맥락",
  knowledge_context: "지식 맥락",
  current_request: "현재 요청",
  constraints: "제약/정책",
  output_format: "출력 형식",
  diagnostic: "진단",
};

export function harnessPromptSectionTitle(value: HarnessPromptSectionType): string {
  return HARNESS_PROMPT_SECTION_TITLE[value] ?? "기타 섹션";
}

/** preview 직렬화 시 section 1개당 content 최대 길이(과대 row 방지). */
export const HARNESS_PROMPT_SECTION_CONTENT_MAX = 2_000;

/** preview 전체 sections 상한. timeline 비대화 방지. */
export const HARNESS_PROMPT_SECTIONS_MAX = 24;

/** warnings 상한. UI 과밀 방지. */
export const HARNESS_PROMPT_PREVIEW_WARNINGS_MAX = 16;

/**
 * Harness Preview의 단일 section.
 *
 * - `id`: section 내부 식별자(stable, deterministic).
 * - `source`: 어떤 raw에서 도출되었는지(예: `overlayIdentity`, `assemblyPlan:memory`).
 * - `includeReason`: 왜 포함되었는지(예: `role_default`, `knowledge_hint`).
 * - `priority`: 0(가장 우선) → 큰 값(낮음). `HARNESS_PROMPT_SECTION_ORDER`의 기본 인덱스를
 *   1차 정렬 키로 쓰고, 이 값은 동일 type 내부 정렬 키로 사용.
 * - `estimatedCost`: 휴리스틱 cost(실제 토큰 수치 아님; budget 추정과 동일한 heuristic).
 */
export type HarnessPromptSection = Readonly<{
  id: string;
  type: HarnessPromptSectionType;
  title: string;
  content: string;
  source: string;
  includeReason: string;
  priority: number;
  estimatedCost: number;
}>;

/**
 * Harness Preview의 최종 객체. 항상 `mode === "dry_run"`.
 *
 * 이 객체는 prompt payload가 아니다 — payload와 별도의 viewmodel/replay metadata로만 흐른다.
 */
export type HarnessPromptAssemblyPreview = Readonly<{
  /** 반드시 `"dry_run"`. 실제 prompt 조립이 아님을 type 시스템에서 강제. */
  mode: "dry_run";
  sections: readonly HarnessPromptSection[];
  totalEstimatedCost: number;
  overflowRisk: HarnessPromptOverflowRisk;
  warnings: readonly string[];
}>;

/**
 * 기존 prompt 본문과 Harness preview 간 diff. enforcement·차단 없음. 진단 metadata only.
 *
 * - `missingSectionTypes`: Harness 표준 section 중 preview에 빠진 type.
 * - `extraSectionTypes`: preview에는 있으나 표준 set 외부에서 등장한 type(현재는 `diagnostic` 등).
 * - `warnings`: 길이 0/큰 차이/missing section 등 진단 메시지.
 */
export type HarnessPromptPreviewDiff = Readonly<{
  existingPromptLength: number;
  previewLength: number;
  sectionCount: number;
  missingSectionTypes: readonly HarnessPromptSectionType[];
  extraSectionTypes: readonly HarnessPromptSectionType[];
  warnings: readonly string[];
}>;

/**
 * Diagnostic API에서 노출하는 가벼운 summary. timeline replay에 저장하기엔 너무 큰
 * preview 본문을 빼고, **운영 대시보드용 5개 키만** 노출한다.
 */
export type HarnessPromptAssemblySummary = Readonly<{
  mode: "dry_run";
  sectionCount: number;
  totalEstimatedCost: number;
  overflowRisk: HarnessPromptOverflowRisk;
  warningCount: number;
}>;

/**
 * `HarnessPromptAssemblyPreview` → `HarnessPromptAssemblySummary` 변환.
 */
export function summarizeHarnessPromptAssemblyPreview(
  preview: HarnessPromptAssemblyPreview | null | undefined
): HarnessPromptAssemblySummary | null {
  if (!preview) return null;
  return {
    mode: "dry_run",
    sectionCount: preview.sections.length,
    totalEstimatedCost: preview.totalEstimatedCost,
    overflowRisk: preview.overflowRisk,
    warningCount: preview.warnings.length,
  };
}

/**
 * 안전한 빈 preview. metadata가 전혀 없거나 생성을 건너뛸 때 fallback으로 사용.
 *
 * - `warnings`에 "Harness preview를 만들 metadata가 부족합니다." 안내.
 */
export function emptyHarnessPromptAssemblyPreview(
  warning?: string
): HarnessPromptAssemblyPreview {
  return {
    mode: "dry_run",
    sections: [],
    totalEstimatedCost: 0,
    overflowRisk: "low",
    warnings: warning ? [warning] : [],
  };
}
