/**
 * Harness Phase H1 — `HarnessPromptAssemblyPreview` builder.
 *
 * read-only / dry-run only. 이 헬퍼는:
 *   - 실제 prompt 조립을 하지 않는다.
 *   - OpenAI 호출과 무관하다.
 *   - retrieval / provider / Cursor execution 어디에도 영향을 주지 않는다.
 *
 * 기존 prompt payload는 그대로 둔 채 "Harness가 표준 방식으로 조립한다면 어떤
 * prompt가 만들어질지" 미리보기 metadata만 만든다. deterministic ordering 보장.
 */

import type {
  OverlayAssemblyPlanItem,
  OverlayAssemblyPlanItemType,
} from "@/lib/overlay/overlayContextAssemblyPlan";
import type { OverlaySelectedContextRef } from "@/lib/overlay/overlayContextSelection";
import type { OverlayContextBudgetMetadata } from "@/lib/overlay/overlayContextBudget";
import { OVERLAY_CONTEXT_BUDGET_CHARS_PER_TOKEN } from "@/lib/overlay/overlayContextBudget";
import type { ExtractedOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import {
  HARNESS_PROMPT_SECTIONS_MAX,
  HARNESS_PROMPT_SECTION_CONTENT_MAX,
  HARNESS_PROMPT_SECTION_ORDER,
  HARNESS_PROMPT_PREVIEW_WARNINGS_MAX,
  harnessPromptSectionTitle,
  type HarnessPromptAssemblyPreview,
  type HarnessPromptOverflowRisk,
  type HarnessPromptSection,
  type HarnessPromptSectionType,
} from "./harnessPromptAssemblyTypes";
import { trimAndClipString } from "./internal/harnessPromptAssemblyStrings";

/** section type별 ordering 인덱스 lookup(상수 시간 정렬). */
const SECTION_ORDER_INDEX: Readonly<Record<HarnessPromptSectionType, number>> = Object.freeze(
  HARNESS_PROMPT_SECTION_ORDER.reduce<Record<HarnessPromptSectionType, number>>((acc, type, idx) => {
    acc[type] = idx;
    return acc;
  }, {} as Record<HarnessPromptSectionType, number>)
);

const ROLE_CONTRACT_BASE_COST = 30;
const CURRENT_REQUEST_MAX_CHARS = 800;
const CONSTRAINTS_TEXT =
  "기존 prompt payload는 변경하지 않는 dry-run preview입니다. 본 Harness preview는 실제 LLM 호출에 사용된 prompt와 다를 수 있습니다.";
const ROLE_CAPABILITIES_EMPTY_LABEL = "(없음)";

/** 1 token ≈ 4 chars (OpenAI 공통 휴리스틱)에 기반한 estimated cost. 실제 토큰 측정 아님. */
function approximateCost(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / OVERLAY_CONTEXT_BUDGET_CHARS_PER_TOKEN));
}

/** Plan item을 section content 단편으로 직렬화(휴리스틱; raw prompt가 아님). */
function planItemToContentLine(item: OverlayAssemblyPlanItem): string {
  const src = trimAndClipString(item.source, 120);
  const reason = trimAndClipString(item.includeReason, 60);
  return `- ${src}${reason ? ` (${reason})` : ""}`;
}

function aggregatePlanCost(items: readonly OverlayAssemblyPlanItem[]): number {
  let total = 0;
  for (const it of items) {
    total += Number.isFinite(it.estimatedCost) ? Math.max(0, Math.floor(it.estimatedCost)) : 0;
  }
  return total;
}

function buildRoleContractSection(
  identity: ExtractedOverlayPromptTraceMetadata["overlayIdentity"] | undefined
): HarnessPromptSection | null {
  if (!identity) return null;
  const capabilities = identity.capabilities?.length
    ? identity.capabilities.join(", ")
    : ROLE_CAPABILITIES_EMPTY_LABEL;
  const content = trimAndClipString(
    [
      `Role: ${identity.roleKey}`,
      `Perspective: ${identity.perspective}`,
      `Provider: ${identity.provider}`,
      `Capabilities: ${capabilities}`,
    ].join("\n"),
    HARNESS_PROMPT_SECTION_CONTENT_MAX
  );
  return {
    id: "role_contract",
    type: "role_contract",
    title: harnessPromptSectionTitle("role_contract"),
    content,
    source: "overlayIdentity",
    includeReason: "role_resolved",
    priority: 0,
    estimatedCost: approximateCost(content) + ROLE_CONTRACT_BASE_COST,
  };
}

function buildPlanSection(
  sectionType: HarnessPromptSectionType,
  sourceLabel: string,
  items: readonly OverlayAssemblyPlanItem[]
): HarnessPromptSection | null {
  if (!items.length) return null;
  const lines = items.map(planItemToContentLine).filter(Boolean);
  if (!lines.length) return null;
  const content = trimAndClipString(lines.join("\n"), HARNESS_PROMPT_SECTION_CONTENT_MAX);
  const priorities = items.map((it) => (Number.isFinite(it.priority) ? it.priority : 999));
  const minPriority = priorities.length ? Math.min(...priorities) : 999;
  return {
    id: `plan:${sectionType}`,
    type: sectionType,
    title: harnessPromptSectionTitle(sectionType),
    content,
    source: sourceLabel,
    includeReason: `assembly_plan:${sectionType}`,
    priority: Math.max(0, minPriority),
    estimatedCost: aggregatePlanCost(items) + approximateCost(content),
  };
}

function buildCurrentRequestSection(
  userRequest: string | null | undefined,
  existingPromptText: string | null | undefined
): HarnessPromptSection | null {
  const requestText = trimAndClipString(userRequest, CURRENT_REQUEST_MAX_CHARS);
  if (requestText) {
    return {
      id: "current_request",
      type: "current_request",
      title: harnessPromptSectionTitle("current_request"),
      content: requestText,
      source: "userRequest",
      includeReason: "user_input",
      priority: 0,
      estimatedCost: approximateCost(requestText),
    };
  }
  // 사용자 입력이 없으면 기존 prompt 본문에서 안전한 발췌(앞/뒤 절반)를 만든다.
  const existing = typeof existingPromptText === "string" ? existingPromptText.trim() : "";
  if (!existing) return null;
  const half = Math.floor(CURRENT_REQUEST_MAX_CHARS / 2);
  const head = existing.slice(0, half);
  const tail =
    existing.length > CURRENT_REQUEST_MAX_CHARS ? `…${existing.slice(existing.length - half)}` : "";
  const content = trimAndClipString(`${head}${tail}`, CURRENT_REQUEST_MAX_CHARS);
  return {
    id: "current_request",
    type: "current_request",
    title: harnessPromptSectionTitle("current_request"),
    content,
    source: "existingPromptText:excerpt",
    includeReason: "existing_prompt_excerpt",
    priority: 5,
    estimatedCost: approximateCost(content),
  };
}

function buildConstraintsSection(): HarnessPromptSection {
  return {
    id: "constraints",
    type: "constraints",
    title: harnessPromptSectionTitle("constraints"),
    content: CONSTRAINTS_TEXT,
    source: "harness_default",
    includeReason: "dry_run_default_policy",
    priority: 0,
    estimatedCost: approximateCost(CONSTRAINTS_TEXT),
  };
}

function deriveOverflowRisk(
  budget: OverlayContextBudgetMetadata | null | undefined
): HarnessPromptOverflowRisk {
  if (!budget) return "low";
  return budget.overflowRisk;
}

/** Plan items를 type별로 그룹화(deterministic). */
function groupPlanByType(
  items: readonly OverlayAssemblyPlanItem[]
): Readonly<Record<OverlayAssemblyPlanItemType, readonly OverlayAssemblyPlanItem[]>> {
  const acc: Record<OverlayAssemblyPlanItemType, OverlayAssemblyPlanItem[]> = {
    memory: [],
    knowledge: [],
    timeline: [],
    workspace: [],
    policy: [],
  };
  for (const it of items) {
    if (acc[it.type]) acc[it.type].push(it);
  }
  return acc;
}

/** section type 노출 인덱스(없으면 999) → priority → id 순으로 deterministic 정렬. */
function sortSectionsDeterministic(sections: readonly HarnessPromptSection[]): HarnessPromptSection[] {
  return [...sections].sort((a, b) => {
    const ai = SECTION_ORDER_INDEX[a.type] ?? 999;
    const bi = SECTION_ORDER_INDEX[b.type] ?? 999;
    if (ai !== bi) return ai - bi;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Harness Phase H1 Preview Builder.
 *
 * 입력은 모두 optional. 부족한 metadata가 있으면 해당 section을 omit하고 `warnings`에 적시.
 * deterministic ordering이 보장된다(동일 입력 → 동일 출력).
 */
export function buildHarnessPromptAssemblyPreview(input: {
  readonly overlayAssemblyPlan?: readonly OverlayAssemblyPlanItem[];
  readonly overlayPrioritizedContextRefs?: readonly OverlaySelectedContextRef[];
  readonly overlayContextBudget?: OverlayContextBudgetMetadata | null;
  readonly overlayIdentity?: ExtractedOverlayPromptTraceMetadata["overlayIdentity"];
  readonly userRequest?: string | null;
  readonly existingPromptText?: string | null;
}): HarnessPromptAssemblyPreview {
  const warnings: string[] = [];
  const sections: HarnessPromptSection[] = [];

  const role = buildRoleContractSection(input.overlayIdentity);
  if (role) {
    sections.push(role);
  } else {
    warnings.push("overlayIdentity가 없어 role_contract 섹션을 생성하지 못했습니다.");
  }

  const plan = input.overlayAssemblyPlan ?? [];
  const byType = groupPlanByType(plan);
  const projectSection = buildPlanSection("project_context", "assemblyPlan:workspace", byType.workspace);
  if (projectSection) sections.push(projectSection);
  const memorySection = buildPlanSection("memory_context", "assemblyPlan:memory", byType.memory);
  if (memorySection) sections.push(memorySection);
  const knowledgeSection = buildPlanSection("knowledge_context", "assemblyPlan:knowledge", byType.knowledge);
  if (knowledgeSection) sections.push(knowledgeSection);
  if (!plan.length) {
    warnings.push("overlayContextAssemblyPlan이 비어 있어 context 섹션을 생성하지 못했습니다.");
  }

  const reqSection = buildCurrentRequestSection(input.userRequest, input.existingPromptText);
  if (reqSection) {
    sections.push(reqSection);
  } else {
    warnings.push(
      "userRequest / existingPromptText가 모두 비어 있어 current_request 섹션을 생성하지 못했습니다."
    );
  }

  sections.push(buildConstraintsSection());

  if (input.overlayContextBudget?.overflowRisk === "high") {
    warnings.push("토큰 예산이 높음 위험 상태입니다. 실제 prompt에서는 일부 맥락이 축약될 수 있습니다.");
  }

  const sorted = sortSectionsDeterministic(sections).slice(0, HARNESS_PROMPT_SECTIONS_MAX);
  const totalEstimatedCost = sorted.reduce(
    (acc, s) => acc + (Number.isFinite(s.estimatedCost) ? Math.max(0, Math.floor(s.estimatedCost)) : 0),
    0
  );
  const overflowRisk = deriveOverflowRisk(input.overlayContextBudget);
  const cappedWarnings = warnings.slice(0, HARNESS_PROMPT_PREVIEW_WARNINGS_MAX);
  return {
    mode: "dry_run",
    sections: sorted,
    totalEstimatedCost,
    overflowRisk,
    warnings: cappedWarnings,
  };
}
