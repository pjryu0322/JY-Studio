/**
 * 업무 목적 기준 산출물 계획 — artifactOrchestration layer 래퍼.
 */

import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  attachOrchestrationToArtifact,
  buildArtifactOrchestrationStateV1,
  orchestrateArtifactPlanning,
  type ArtifactOrchestrationContext,
  type ArtifactOrchestrationPlanResult,
  type ArtifactOrchestrationStateV1,
  type OrchestratedPlannedArtifact,
} from "@/lib/requirements/artifactOrchestration";
import { generateProjectArtifact, type ProjectArtifactGenerateInput } from "@/lib/requirements/projectArtifactGenerate";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import type { PlatformMemberDraft, PlatformMemberRole } from "@/lib/platform-orchestration/types";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import {
  PROJECT_ARTIFACT_LABELS,
  type ProjectArtifactType,
} from "@/lib/requirements/projectArtifactTypes";
import { projectArtifactToDeliverableAsset } from "@/lib/requirements/projectArtifactViewer";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export {
  orchestrateArtifactPlanning,
  buildArtifactOrchestrationStateV1,
  type ArtifactOrchestrationPlanResult,
  type ArtifactOrchestrationStateV1,
  type OrchestratedPlannedArtifact,
} from "@/lib/requirements/artifactOrchestration";

/** @deprecated Quick Design 영역 산출물 — 기존 state 정리용 */
export const LEGACY_QUICK_DESIGN_AREA_TITLES: ReadonlySet<string> = new Set([
  "서비스 정의 산출물",
  "분석 산출물",
  "설계 산출물",
  "디자인 산출물",
]);

/** 구현 gate 기본값 — 동적 계획 결과가 없을 때 최소 요약·프로토타입 */
export const FALLBACK_IMPLEMENTATION_ARTIFACT_TYPES: readonly ProjectArtifactType[] = [
  "summary",
  "fast_prototype_plan",
] as const;

export type PlannedArtifactPriority = "required" | "recommended";

/** @deprecated — OrchestratedPlannedArtifact 사용 권장 */
export type PlannedProjectArtifact = Readonly<{
  readonly artifactType: ProjectArtifactType;
  readonly title: string;
  readonly priority: PlannedArtifactPriority;
  readonly recommendedByRole?: PlatformMemberRole;
  readonly reason?: string;
  readonly sourceRoles?: readonly PlatformMemberRole[];
  readonly sourceSlotKeys?: readonly string[];
  readonly confidence?: number;
}>;

export type ProjectArtifactPlanContext = Readonly<{
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly serviceFlow?: RequirementsServiceFlowV1 | null;
  readonly featurePlanning?: FeaturePlanningSlotsArtifactV1 | null;
  readonly memberDrafts?: readonly PlatformMemberDraft[];
  readonly conversationMessages?: readonly RequirementsMessage[];
  readonly nowIso?: string;
}>;

export type ProjectArtifactPlanResult = Readonly<{
  readonly planned: readonly PlannedProjectArtifact[];
  readonly requiredTypes: readonly ProjectArtifactType[];
  readonly recommended: readonly PlannedProjectArtifact[];
  readonly orchestration: ArtifactOrchestrationPlanResult;
  readonly orchestrationState: ArtifactOrchestrationStateV1;
}>;

function toLegacyPlanned(row: OrchestratedPlannedArtifact): PlannedProjectArtifact {
  return {
    artifactType: row.type,
    title: row.title,
    priority: row.required ? "required" : "recommended",
    reason: row.reason,
    sourceRoles: row.sourceRoles,
    sourceSlotKeys: row.sourceSlotKeys,
    confidence: row.confidence,
    ...(row.required ? {} : { recommendedByRole: row.sourceRoles[0] }),
  };
}

function toOrchestrationContext(input: ProjectArtifactPlanContext): ArtifactOrchestrationContext {
  return {
    orchestration: input.orchestration,
    definitions: input.definitions,
    serviceFlow: input.serviceFlow,
    featurePlanning: input.featurePlanning,
    memberDrafts: input.memberDrafts,
    conversationMessages: input.conversationMessages,
    nowIso: input.nowIso,
  };
}

export function planProjectArtifactsFromOrchestrationContext(
  input: ProjectArtifactPlanContext,
): ProjectArtifactPlanResult {
  const orchestration = orchestrateArtifactPlanning(toOrchestrationContext(input));
  const nowIso = input.nowIso ?? new Date().toISOString();
  const planned = orchestration.planned.map(toLegacyPlanned);
  return {
    planned,
    requiredTypes: orchestration.requiredTypes,
    recommended: orchestration.recommended.map(toLegacyPlanned),
    orchestration,
    orchestrationState: buildArtifactOrchestrationStateV1(orchestration, nowIso),
  };
}

function buildSupplementalMarkdown(input: {
  readonly title: string;
  readonly projectName: string;
  readonly role: PlatformMemberRole;
  readonly memberDrafts?: readonly PlatformMemberDraft[];
  readonly reason: string;
}): string {
  const body = String((input.memberDrafts ?? []).find((d) => d.role === input.role)?.content ?? "").trim();
  return [
    `# ${input.projectName} — ${input.title}`,
    "",
    `> ${input.reason}`,
    "",
    body || "_해당 역할 초안이 아직 없습니다. 슬롯·대화를 보완한 뒤 다시 생성해 주세요._",
  ].join("\n");
}

function orchestratedRowFromLegacy(row: PlannedProjectArtifact): OrchestratedPlannedArtifact {
  return {
    type: row.artifactType,
    title: row.title,
    required: row.priority === "required",
    reason: row.reason ?? "AI팀 판단",
    sourceRoles: row.sourceRoles ?? (row.recommendedByRole ? [row.recommendedByRole] : ["planner"]),
    sourceSlotKeys: row.sourceSlotKeys ?? [],
    confidence: row.confidence ?? 0.7,
  };
}

export function generateArtifactsFromPlan(input: {
  readonly plan: readonly PlannedProjectArtifact[];
  readonly orchestration?: ArtifactOrchestrationPlanResult;
  readonly base: Omit<ProjectArtifactGenerateInput, "artifactType">;
  readonly memberDrafts?: readonly PlatformMemberDraft[];
  readonly onlyRequired?: boolean;
  readonly conversationMessages?: readonly RequirementsMessage[];
}): readonly ProjectArtifact[] {
  const orch = input.orchestration;
  const orchByType = new Map(
    (orch?.planned ?? []).map((p) => [p.type === "summary" && p.title !== PROJECT_ARTIFACT_LABELS.summary ? `summary:${p.title}` : p.type, p]),
  );
  const rows = input.onlyRequired ? input.plan.filter((p) => p.priority === "required") : input.plan;
  const nowIso = input.base.nowIso ?? new Date().toISOString();
  const projectName = String(input.base.projectName ?? "프로젝트").trim() || "프로젝트";
  const profile = orch?.serviceProfile ?? "standard";
  const out: ProjectArtifact[] = [];

  for (const legacyRow of rows) {
    const key =
      legacyRow.artifactType === "summary" && legacyRow.title !== PROJECT_ARTIFACT_LABELS.summary
        ? `summary:${legacyRow.title}`
        : legacyRow.artifactType;
    const planRow = orchByType.get(key) ?? orchestratedRowFromLegacy(legacyRow);

    const isSupplemental =
      legacyRow.artifactType === "summary" && legacyRow.title !== PROJECT_ARTIFACT_LABELS.summary;
    if (isSupplemental) {
      const id = `artifact-${nowIso.replace(/[^\d]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
      const raw: ProjectArtifact = {
        id,
        type: "summary",
        title: legacyRow.title,
        createdAt: nowIso,
        createdBy: "ai",
        sourceStage: String(input.base.sourceStage ?? "IDEATION"),
        content: buildSupplementalMarkdown({
          title: legacyRow.title,
          projectName,
          role: legacyRow.recommendedByRole ?? planRow.sourceRoles[0] ?? "planner",
          memberDrafts: input.memberDrafts,
          reason: planRow.reason,
        }),
      };
      out.push(
        attachOrchestrationToArtifact({
          artifact: raw,
          planRow,
          serviceProfile: profile,
          nowIso,
          conversationMessages: input.conversationMessages,
        }),
      );
      continue;
    }

    const artifact = generateProjectArtifact({
      ...input.base,
      nowIso,
      artifactType: legacyRow.artifactType,
      titleOverride: legacyRow.title,
      fastPlanContext: legacyRow.artifactType === "fast_prototype_plan" ? input.base.fastPlanContext : undefined,
    });
    out.push(
      attachOrchestrationToArtifact({
        artifact,
        planRow,
        serviceProfile: profile,
        nowIso,
        conversationMessages: input.conversationMessages,
      }),
    );
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
