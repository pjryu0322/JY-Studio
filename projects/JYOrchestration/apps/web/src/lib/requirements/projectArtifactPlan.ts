/**
 * 업무 목적 기준 산출물 계획 — Quick Design 영역 산출물 대신 표준 문서 유형 + AI 추천.
 */

import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import { generateProjectArtifact, type ProjectArtifactGenerateInput } from "@/lib/requirements/projectArtifactGenerate";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { PlatformMemberDraft, PlatformMemberRole } from "@/lib/platform-orchestration/types";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import {
  PROJECT_ARTIFACT_LABELS,
  STANDARD_ARTIFACT_HUB_GENERATE_ORDER,
  type ProjectArtifactType,
} from "@/lib/requirements/projectArtifactTypes";
import { projectArtifactToDeliverableAsset } from "@/lib/requirements/projectArtifactViewer";
import { findOrchestrationSlotKeysBySuffix, findSlotRow } from "@/lib/requirements/singleChatSlotNextAction";
import { normalizeSlotStatus } from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";

/** @deprecated Quick Design 영역 산출물 — 기존 state 정리용 */
export const LEGACY_QUICK_DESIGN_AREA_TITLES: ReadonlySet<string> = new Set([
  "서비스 정의 산출물",
  "분석 산출물",
  "설계 산출물",
  "디자인 산출물",
]);

export const REQUIRED_IMPLEMENTATION_ARTIFACT_TYPES: readonly ProjectArtifactType[] = [
  "summary",
  "service-flow-doc",
  "feature-spec",
  "screen-spec",
  "api-spec",
  "fast_prototype_plan",
] as const;

export type PlannedArtifactPriority = "required" | "recommended";

export type PlannedProjectArtifact = Readonly<{
  readonly artifactType: ProjectArtifactType;
  readonly title: string;
  readonly priority: PlannedArtifactPriority;
  readonly recommendedByRole?: PlatformMemberRole;
  readonly reason?: string;
}>;

export type ProjectArtifactPlanContext = Readonly<{
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly serviceFlow?: RequirementsServiceFlowV1 | null;
  readonly featurePlanning?: FeaturePlanningSlotsArtifactV1 | null;
  readonly memberDrafts?: readonly PlatformMemberDraft[];
}>;

export type ProjectArtifactPlanResult = Readonly<{
  readonly planned: readonly PlannedProjectArtifact[];
  readonly requiredTypes: readonly ProjectArtifactType[];
  readonly recommended: readonly PlannedProjectArtifact[];
}>;

type SupplementalDef = Readonly<{
  readonly title: string;
  readonly roles: readonly PlatformMemberRole[];
  readonly slotSuffixes?: readonly string[];
}>;

const SUPPLEMENTAL_BY_MEMBER: readonly SupplementalDef[] = [
  { title: "권한 정책서", roles: ["security"], slotSuffixes: [".security", ".auth", ".permission"] },
  { title: "검수 기준서", roles: ["reviewer"] },
  { title: "예외 흐름 정의서", roles: ["analyst"], slotSuffixes: [".flow.exceptionFlow", ".flow.approvalFlow"] },
  { title: "데이터 항목 정의서", roles: ["architect"], slotSuffixes: [".design.dataFlow"] },
  { title: "연계 정의서", roles: ["architect", "developer"], slotSuffixes: [".integration"] },
] as const;

function planKey(row: PlannedProjectArtifact): string {
  return row.artifactType === "summary" && row.title !== PROJECT_ARTIFACT_LABELS.summary
    ? `summary:${row.title}`
    : row.artifactType;
}

function slotConfirmed(
  orchestration: RequirementsSingleChatOrchestrationStateV1,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  suffix: string,
): boolean {
  const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
  if (!key) return false;
  const row = findSlotRow(orchestration, key);
  const status = normalizeSlotStatus(String(row?.status ?? "empty"));
  const value = String(row?.value ?? "").trim();
  return status === "confirmed" && value.length >= 4;
}

function hasServiceFlowData(flow: RequirementsServiceFlowV1 | null | undefined): boolean {
  const hydrated = flow ? hydrateServiceFlowStepsFromAlternativePayload(flow) : null;
  return Boolean(hydrated?.steps?.length);
}

function hasFeaturePlanningData(fp: FeaturePlanningSlotsArtifactV1 | null | undefined): boolean {
  return Boolean((fp?.slots ?? []).filter((s) => !s.legacy).length);
}

function memberDraftForRole(drafts: readonly PlatformMemberDraft[] | undefined, role: PlatformMemberRole): string {
  return String((drafts ?? []).find((d) => d.role === role)?.content ?? "").trim();
}

function buildSupplementalMarkdown(input: {
  readonly title: string;
  readonly projectName: string;
  readonly role: PlatformMemberRole;
  readonly memberDrafts?: readonly PlatformMemberDraft[];
}): string {
  const body = memberDraftForRole(input.memberDrafts, input.role);
  return [
    `# ${input.projectName} — ${input.title}`,
    "",
    `> AI멤버(${input.role}) 판단 기준 초안`,
    "",
    body || "_해당 역할 초안이 아직 없습니다. 슬롯·대화를 보완한 뒤 다시 생성해 주세요._",
  ].join("\n");
}

function pushUnique(planned: PlannedProjectArtifact[], row: PlannedProjectArtifact): void {
  const key = planKey(row);
  if (planned.some((p) => planKey(p) === key)) return;
  planned.push(row);
}

export function planProjectArtifactsFromOrchestrationContext(
  input: ProjectArtifactPlanContext,
): ProjectArtifactPlanResult {
  const planned: PlannedProjectArtifact[] = [];
  const { orchestration, definitions } = input;
  const drafts = input.memberDrafts ?? [];

  pushUnique(planned, {
    artifactType: "summary",
    title: PROJECT_ARTIFACT_LABELS.summary,
    priority: "required",
    reason: "프로젝트 개요·확정 슬롯 스냅샷",
  });

  if (hasServiceFlowData(input.serviceFlow) || slotConfirmed(orchestration, definitions, ".flow.serviceFlow")) {
    pushUnique(planned, {
      artifactType: "service-flow-doc",
      title: PROJECT_ARTIFACT_LABELS["service-flow-doc"],
      priority: "required",
      reason: "서비스 흐름·액터 슬롯",
    });
  }

  if (hasFeaturePlanningData(input.featurePlanning) || slotConfirmed(orchestration, definitions, ".design.coreFeatures")) {
    pushUnique(planned, {
      artifactType: "feature-spec",
      title: PROJECT_ARTIFACT_LABELS["feature-spec"],
      priority: "required",
      reason: "핵심 기능·MVP",
    });
  }

  if (slotConfirmed(orchestration, definitions, ".design.requiredScreens") || hasFeaturePlanningData(input.featurePlanning)) {
    pushUnique(planned, {
      artifactType: "screen-spec",
      title: PROJECT_ARTIFACT_LABELS["screen-spec"],
      priority: "required",
      reason: "주요 화면",
    });
  }

  if (slotConfirmed(orchestration, definitions, ".design.dataFlow") || hasFeaturePlanningData(input.featurePlanning)) {
    pushUnique(planned, {
      artifactType: "api-spec",
      title: PROJECT_ARTIFACT_LABELS["api-spec"],
      priority: "required",
      reason: "데이터·연동",
    });
  }

  pushUnique(planned, {
    artifactType: "fast_prototype_plan",
    title: PROJECT_ARTIFACT_LABELS["fast_prototype_plan"],
    priority: "required",
    reason: "프로토타입 범위",
  });

  const rolesPresent = new Set(drafts.map((d) => d.role));
  for (const def of SUPPLEMENTAL_BY_MEMBER) {
    const roleHit = def.roles.some((r) => rolesPresent.has(r));
    const slotHit = (def.slotSuffixes ?? []).some((s) => slotConfirmed(orchestration, definitions, s));
    if (!roleHit && !slotHit) continue;
    const role = def.roles.find((r) => rolesPresent.has(r)) ?? def.roles[0]!;
    pushUnique(planned, {
      artifactType: "summary",
      title: def.title,
      priority: "recommended",
      recommendedByRole: role,
      reason: `AI멤버(${role}) 추천`,
    });
  }

  const required = planned.filter((p) => p.priority === "required");
  return {
    planned,
    requiredTypes: required.map((p) => p.artifactType),
    recommended: planned.filter((p) => p.priority === "recommended"),
  };
}

export function generateArtifactsFromPlan(input: {
  readonly plan: readonly PlannedProjectArtifact[];
  readonly base: Omit<ProjectArtifactGenerateInput, "artifactType">;
  readonly memberDrafts?: readonly PlatformMemberDraft[];
  readonly onlyRequired?: boolean;
}): readonly ProjectArtifact[] {
  const rows = input.onlyRequired ? input.plan.filter((p) => p.priority === "required") : input.plan;
  const nowIso = input.base.nowIso ?? new Date().toISOString();
  const projectName = String(input.base.projectName ?? "프로젝트").trim() || "프로젝트";
  const out: ProjectArtifact[] = [];

  for (const row of rows) {
    const isSupplemental =
      row.artifactType === "summary" && row.title !== PROJECT_ARTIFACT_LABELS.summary;
    if (isSupplemental) {
      const id = `artifact-${nowIso.replace(/[^\d]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
      out.push({
        id,
        type: "summary",
        title: row.title,
        createdAt: nowIso,
        createdBy: "ai",
        sourceStage: String(input.base.sourceStage ?? "IDEATION"),
        content: buildSupplementalMarkdown({
          title: row.title,
          projectName,
          role: row.recommendedByRole ?? "planner",
          memberDrafts: input.memberDrafts,
        }),
      });
      continue;
    }

    const artifact = generateProjectArtifact({
      ...input.base,
      nowIso,
      artifactType: row.artifactType,
      titleOverride: row.title,
      fastPlanContext: row.artifactType === "fast_prototype_plan" ? input.base.fastPlanContext : undefined,
    });
    out.push(artifact);
  }

  return out;
}

export function mergePlannedArtifactsIntoState(input: {
  readonly priorArtifacts: readonly ProjectArtifact[] | null | undefined;
  readonly priorDeliverables: readonly IdeationDeliverableAsset[] | null | undefined;
  readonly newArtifacts: readonly ProjectArtifact[];
  readonly replacedTypes: readonly ProjectArtifactType[];
  readonly projectId: string;
}): Readonly<{
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly deliverableAssets: readonly IdeationDeliverableAsset[];
}> {
  const replaced = new Set(input.replacedTypes);
  const replacedTitles = new Set(
    input.newArtifacts.filter((a) => a.type === "summary").map((a) => String(a.title ?? "").trim()),
  );

  const priorArtifacts = (input.priorArtifacts ?? []).filter((a) => {
    const title = String(a.title ?? "").trim();
    if (LEGACY_QUICK_DESIGN_AREA_TITLES.has(title)) return false;
    if (replaced.has(a.type)) {
      if (a.type === "summary") return !replacedTitles.has(title);
      return false;
    }
    return true;
  });

  const newDeliverables = input.newArtifacts.map((a) => projectArtifactToDeliverableAsset(a, input.projectId));
  const newTitles = new Set(newDeliverables.map((d) => String(d.title ?? "").trim()));
  const priorDeliverables = (input.priorDeliverables ?? []).filter((d) => {
    const title = String(d.title ?? "").trim();
    if (LEGACY_QUICK_DESIGN_AREA_TITLES.has(title)) return false;
    return !newTitles.has(title);
  });

  return {
    projectArtifacts: [...priorArtifacts, ...input.newArtifacts],
    deliverableAssets: [...priorDeliverables, ...newDeliverables],
  };
}
