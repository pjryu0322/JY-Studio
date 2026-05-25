/**
 * Artifact Planning / Generation Orchestration — slot·AI멤버·서비스 특성 기반 산출물 계획.
 */

import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import type { PlatformMemberDraft, PlatformMemberRole } from "@/lib/platform-orchestration/types";
import { PLATFORM_ROLE_DEFINITIONS } from "@/lib/platform-orchestration/roles";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ProjectArtifact, ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";
import { PROJECT_ARTIFACT_LABELS } from "@/lib/requirements/projectArtifactTypes";
import { findOrchestrationSlotKeysBySuffix, findSlotRow } from "@/lib/requirements/singleChatSlotNextAction";
import { normalizeSlotStatus } from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import {
  evaluateArtifactContentQuality,
  isPlaceholderOnlyArtifactContent,
} from "@/lib/requirements/artifactContentGeneration";

export type ArtifactServiceProfile = "standard" | "static_prototype" | "external_integration";

export type ArtifactTrace = Readonly<{
  readonly artifactType: ProjectArtifactType;
  readonly section: string;
  readonly sourceSlots: readonly string[];
  readonly sourceMessages: readonly string[];
  readonly sourceRoles: readonly string[];
}>;

export type OrchestratedPlannedArtifact = Readonly<{
  readonly type: ProjectArtifactType;
  readonly title: string;
  readonly required: boolean;
  readonly reason: string;
  readonly sourceRoles: readonly PlatformMemberRole[];
  readonly sourceSlotKeys: readonly string[];
  readonly confidence: number;
}>;

export type ArtifactOrchestrationPlanResult = Readonly<{
  readonly planned: readonly OrchestratedPlannedArtifact[];
  readonly requiredTypes: readonly ProjectArtifactType[];
  readonly recommended: readonly OrchestratedPlannedArtifact[];
  readonly serviceProfile: ArtifactServiceProfile;
  readonly memberRoles: readonly PlatformMemberRole[];
  readonly planningSummary: string;
}>;

export type ProjectArtifactOrchestrationMeta = Readonly<{
  readonly reason: string;
  readonly required: boolean;
  readonly confidence: number;
  readonly sourceRoles: readonly string[];
  readonly sourceSlotKeys: readonly string[];
  readonly trace: readonly ArtifactTrace[];
  readonly completenessScore: number;
  readonly hubReadinessLabel: string;
  readonly improvementHint?: string;
  readonly isPlaceholderOnly?: boolean;
  readonly serviceProfile?: ArtifactServiceProfile;
  readonly plannedAt: string;
}>;

export type ArtifactOrchestrationStateV1 = Readonly<{
  readonly plannedAt: string;
  readonly serviceProfile: ArtifactServiceProfile;
  readonly requiredTypes: readonly ProjectArtifactType[];
  readonly planned: readonly OrchestratedPlannedArtifact[];
  readonly memberRoles: readonly PlatformMemberRole[];
  readonly planningSummary: string;
}>;

export type ArtifactOrchestrationContext = Readonly<{
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly serviceFlow?: RequirementsServiceFlowV1 | null;
  readonly featurePlanning?: FeaturePlanningSlotsArtifactV1 | null;
  readonly memberDrafts?: readonly PlatformMemberDraft[];
  readonly conversationMessages?: readonly RequirementsMessage[];
  readonly nowIso?: string;
}>;

const ROLE_LABEL: Readonly<Record<PlatformMemberRole, string>> = Object.fromEntries(
  PLATFORM_ROLE_DEFINITIONS.map((d) => [d.role, d.labelKo]),
) as Record<PlatformMemberRole, string>;

function roleLabel(role: PlatformMemberRole): string {
  return ROLE_LABEL[role] ?? role;
}

function slotKeysForSuffix(
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  suffix: string,
): readonly string[] {
  return findOrchestrationSlotKeysBySuffix(definitions, suffix);
}

function slotRow(
  orchestration: RequirementsSingleChatOrchestrationStateV1,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  suffix: string,
): { readonly key: string; readonly label: string; readonly status: string; readonly value: string } | null {
  const key = slotKeysForSuffix(definitions, suffix)[0];
  if (!key) return null;
  const row = findSlotRow(orchestration, key);
  return {
    key,
    label: String(row?.label ?? key),
    status: normalizeSlotStatus(String(row?.status ?? "empty")),
    value: String(row?.value ?? "").trim(),
  };
}

function slotConfirmed(
  orchestration: RequirementsSingleChatOrchestrationStateV1,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  suffix: string,
): boolean {
  const row = slotRow(orchestration, definitions, suffix);
  return Boolean(row && row.status === "confirmed" && row.value.length >= 4);
}

function slotKeysWithStatus(
  orchestration: RequirementsSingleChatOrchestrationStateV1,
  definitions: readonly SingleChatOrchestrationSlotDefinition[],
  suffix: string,
  statuses: readonly string[],
): readonly string[] {
  const keys = slotKeysForSuffix(definitions, suffix);
  return keys.filter((key) => {
    const row = findSlotRow(orchestration, key);
    const status = normalizeSlotStatus(String(row?.status ?? "empty"));
    const value = String(row?.value ?? "").trim();
    return statuses.includes(status) && value.length >= 2;
  });
}

function hasServiceFlowData(flow: RequirementsServiceFlowV1 | null | undefined): boolean {
  const hydrated = flow ? hydrateServiceFlowStepsFromAlternativePayload(flow) : null;
  return Boolean(hydrated?.steps?.length);
}

function flowStepCount(flow: RequirementsServiceFlowV1 | null | undefined): number {
  const hydrated = flow ? hydrateServiceFlowStepsFromAlternativePayload(flow) : null;
  return hydrated?.steps?.length ?? 0;
}

function hasFeaturePlanningData(fp: FeaturePlanningSlotsArtifactV1 | null | undefined): boolean {
  return Boolean((fp?.slots ?? []).filter((s) => !s.legacy).length);
}

function screenSlotCount(fp: FeaturePlanningSlotsArtifactV1 | null | undefined): number {
  return (fp?.slots ?? []).filter(
    (s) => !s.legacy && (s.slotType === "SCREEN" || s.slotType === "UI" || /screen|화면/i.test(`${s.slotKey} ${s.slotName}`)),
  ).length;
}

function draftMentions(drafts: readonly PlatformMemberDraft[] | undefined, pattern: RegExp): boolean {
  return (drafts ?? []).some((d) => pattern.test(String(d.content ?? "")));
}

export function detectArtifactServiceProfile(input: ArtifactOrchestrationContext): ArtifactServiceProfile {
  const { orchestration, definitions } = input;
  const integration =
    slotConfirmed(orchestration, definitions, ".integration") ||
    slotKeysWithStatus(orchestration, definitions, ".integration", ["confirmed", "candidate", "partial"]).length > 0 ||
    draftMentions(input.memberDrafts, /연계|외부\s*API|integration|webhook/i);
  if (integration) return "external_integration";

  const complexFlow = flowStepCount(input.serviceFlow) >= 4 || slotConfirmed(orchestration, definitions, ".flow.exceptionFlow");
  if (!complexFlow && screenSlotCount(input.featurePlanning) <= 2 && !slotConfirmed(orchestration, definitions, ".design.dataFlow")) {
    return "static_prototype";
  }
  return "standard";
}

type Proposal = OrchestratedPlannedArtifact;

function pushProposal(out: Proposal[], row: Proposal): void {
  const key =
    row.type === "summary" && row.title !== PROJECT_ARTIFACT_LABELS.summary ? `summary:${row.title}` : row.type;
  const idx = out.findIndex(
    (p) => (p.type === "summary" && p.title !== PROJECT_ARTIFACT_LABELS.summary ? `summary:${p.title}` : p.type) === key,
  );
  if (idx < 0) {
    out.push(row);
    return;
  }
  const prev = out[idx]!;
  out[idx] = {
    ...prev,
    required: prev.required || row.required,
    reason: prev.reason.length >= row.reason.length ? prev.reason : row.reason,
    sourceRoles: [...new Set([...prev.sourceRoles, ...row.sourceRoles])],
    sourceSlotKeys: [...new Set([...prev.sourceSlotKeys, ...row.sourceSlotKeys])],
    confidence: Math.max(prev.confidence, row.confidence),
  };
}

function plannerProposals(ctx: ArtifactOrchestrationContext): Proposal[] {
  const { orchestration, definitions } = ctx;
  const slots = [
    ...slotKeysWithStatus(orchestration, definitions, ".planning.servicePurpose", ["confirmed", "partial", "candidate"]),
    ...slotKeysWithStatus(orchestration, definitions, ".planning.problem", ["confirmed", "partial", "candidate"]),
  ];
  return [
    {
      type: "summary",
      title: PROJECT_ARTIFACT_LABELS.summary,
      required: true,
      reason: `${roleLabel("planner")}: 확정·후보 슬롯과 대화를 프로젝트 요약서로 통합해야 합니다.`,
      sourceRoles: ["planner"],
      sourceSlotKeys: slots,
      confidence: 0.92,
    },
    {
      type: "fast_prototype_plan",
      title: PROJECT_ARTIFACT_LABELS.fast_prototype_plan,
      required: true,
      reason: `${roleLabel("planner")}: 구현 범위·MVP 우선순위를 프로토타입 기획안으로 고정합니다.`,
      sourceRoles: ["planner"],
      sourceSlotKeys: slotKeysWithStatus(orchestration, definitions, ".design.coreFeatures", ["confirmed", "candidate"]),
      confidence: 0.88,
    },
  ];
}

function analystProposals(ctx: ArtifactOrchestrationContext): Proposal[] {
  const { orchestration, definitions } = ctx;
  const out: Proposal[] = [];
  const flowSlots = slotKeysWithStatus(orchestration, definitions, ".flow.serviceFlow", ["confirmed", "candidate", "partial"]);
  if (hasServiceFlowData(ctx.serviceFlow) || flowSlots.length) {
    pushProposal(out, {
      type: "service-flow-doc",
      title: PROJECT_ARTIFACT_LABELS["service-flow-doc"],
      required: true,
      reason: `${roleLabel("analyst")}: 서비스 흐름·액터 분석 결과를 문서화해야 합니다.`,
      sourceRoles: ["analyst"],
      sourceSlotKeys: [
        ...flowSlots,
        ...slotKeysWithStatus(orchestration, definitions, ".flow.actorTypes", ["confirmed", "candidate"]),
      ],
      confidence: 0.9,
    });
  }
  const complex =
    flowStepCount(ctx.serviceFlow) >= 4 ||
    slotConfirmed(orchestration, definitions, ".flow.exceptionFlow") ||
    draftMentions(ctx.memberDrafts, /예외|분기|승인/i);
  if (complex) {
    pushProposal(out, {
      type: "summary",
      title: "예외 흐름 정의서",
      required: false,
      reason: `${roleLabel("analyst")}: 흐름 분기·예외 처리가 복잡해 예외 흐름 정의서가 필요합니다.`,
      sourceRoles: ["analyst"],
      sourceSlotKeys: slotKeysWithStatus(orchestration, definitions, ".flow.exceptionFlow", ["confirmed", "candidate"]),
      confidence: 0.75,
    });
  }
  return out;
}

function architectProposals(ctx: ArtifactOrchestrationContext, profile: ArtifactServiceProfile): Proposal[] {
  const { orchestration, definitions } = ctx;
  const out: Proposal[] = [];
  const featureSlots = slotKeysWithStatus(orchestration, definitions, ".design.coreFeatures", ["confirmed", "candidate", "partial"]);
  if (hasFeaturePlanningData(ctx.featurePlanning) || featureSlots.length) {
    pushProposal(out, {
      type: "feature-spec",
      title: PROJECT_ARTIFACT_LABELS["feature-spec"],
      required: true,
      reason: `${roleLabel("architect")}: 핵심 기능·데이터 관점을 기능 정의서로 정리해야 합니다.`,
      sourceRoles: ["architect"],
      sourceSlotKeys: [
        ...featureSlots,
        ...slotKeysWithStatus(orchestration, definitions, ".design.dataFlow", ["confirmed", "candidate"]),
      ],
      confidence: 0.9,
    });
  }
  const needsApi =
    profile === "external_integration" ||
    slotConfirmed(orchestration, definitions, ".design.dataFlow") ||
    draftMentions(ctx.memberDrafts, /API|엔드포인트|연계/i);
  if (needsApi) {
    pushProposal(out, {
      type: "api-spec",
      title: PROJECT_ARTIFACT_LABELS["api-spec"],
      required: profile === "external_integration",
      reason:
        profile === "external_integration"
          ? `${roleLabel("architect")}: 외부 연계·API 연동이 있어 API 명세서가 필수입니다.`
          : `${roleLabel("architect")}: 데이터·연동 슬롯이 있어 API 명세서를 권장합니다.`,
      sourceRoles: ["architect"],
      sourceSlotKeys: slotKeysWithStatus(orchestration, definitions, ".design.dataFlow", ["confirmed", "candidate", "partial"]),
      confidence: profile === "external_integration" ? 0.88 : 0.72,
    });
    if (profile === "external_integration") {
      pushProposal(out, {
        type: "summary",
        title: "연계 정의서",
        required: true,
        reason: `${roleLabel("architect")}: 외부 시스템 연계 범위를 연계 정의서로 명시해야 합니다.`,
        sourceRoles: ["architect", "developer"],
        sourceSlotKeys: slotKeysWithStatus(orchestration, definitions, ".integration", ["confirmed", "candidate", "partial"]),
        confidence: 0.85,
      });
    }
  }
  return out;
}

function designerProposals(ctx: ArtifactOrchestrationContext): Proposal[] {
  const { orchestration, definitions } = ctx;
  const screenSlots = slotKeysWithStatus(orchestration, definitions, ".design.requiredScreens", ["confirmed", "candidate", "partial"]);
  const count = Math.max(screenSlots.length, screenSlotCount(ctx.featurePlanning));
  if (count === 0 && !hasFeaturePlanningData(ctx.featurePlanning)) return [];
  return [
    {
      type: "screen-spec",
      title: PROJECT_ARTIFACT_LABELS["screen-spec"],
      required: count >= 1,
      reason: `${roleLabel("designer")}: 주요 화면(${count}건 후보)을 화면 정의서로 정리해야 합니다.`,
      sourceRoles: ["designer"],
      sourceSlotKeys: screenSlots,
      confidence: count >= 2 ? 0.88 : 0.7,
    },
  ];
}

/** AI멤버 기반 artifact planning orchestration */
export function orchestrateArtifactPlanning(ctx: ArtifactOrchestrationContext): ArtifactOrchestrationPlanResult {
  const profile = detectArtifactServiceProfile(ctx);
  const planned: Proposal[] = [];

  for (const row of plannerProposals(ctx)) pushProposal(planned, row);
  for (const row of analystProposals(ctx)) pushProposal(planned, row);
  for (const row of architectProposals(ctx, profile)) pushProposal(planned, row);
  for (const row of designerProposals(ctx)) pushProposal(planned, row);

  if (profile === "static_prototype") {
    for (let i = 0; i < planned.length; i++) {
      if (planned[i]!.type === "api-spec" && !planned[i]!.required) {
        planned.splice(i, 1);
        i -= 1;
      } else if (planned[i]!.type === "api-spec") {
        planned[i] = { ...planned[i]!, required: false, reason: `${planned[i]!.reason} (정적 프로토타입 — 구현 단계에서 생략 가능)` };
      }
    }
  }

  const required = planned.filter((p) => p.required);
  const requiredTypes = required.map((p) => p.type);
  const memberRoles = [
    ...new Set(planned.flatMap((p) => p.sourceRoles)),
  ] as PlatformMemberRole[];

  const planningSummary = `AI팀이 현재 프로젝트(${profile === "external_integration" ? "외부 연계형" : profile === "static_prototype" ? "정적 프로토타입" : "표준"}) 기준으로 필요한 산출물 ${required.length}건·추천 ${planned.length - required.length}건을 구성했습니다.`;

  return {
    planned,
    requiredTypes,
    recommended: planned.filter((p) => !p.required),
    serviceProfile: profile,
    memberRoles,
    planningSummary,
  };
}

export function buildArtifactOrchestrationStateV1(
  plan: ArtifactOrchestrationPlanResult,
  nowIso: string,
): ArtifactOrchestrationStateV1 {
  return {
    plannedAt: nowIso,
    serviceProfile: plan.serviceProfile,
    requiredTypes: plan.requiredTypes,
    planned: plan.planned,
    memberRoles: plan.memberRoles,
    planningSummary: plan.planningSummary,
  };
}

export function buildArtifactTraceForPlannedRow(
  row: OrchestratedPlannedArtifact,
  conversationMessages?: readonly RequirementsMessage[],
): readonly ArtifactTrace[] {
  const msgIds = (conversationMessages ?? [])
    .slice(-6)
    .map((m) => String(m.id ?? "").trim())
    .filter(Boolean);
  return [
    {
      artifactType: row.type,
      section: row.title,
      sourceSlots: row.sourceSlotKeys,
      sourceMessages: msgIds,
      sourceRoles: row.sourceRoles.map((r) => roleLabel(r)),
    },
  ];
}

export function attachOrchestrationToArtifact(input: {
  readonly artifact: ProjectArtifact;
  readonly planRow: OrchestratedPlannedArtifact;
  readonly serviceProfile: ArtifactServiceProfile;
  readonly nowIso: string;
  readonly conversationMessages?: readonly RequirementsMessage[];
}): ProjectArtifact {
  const content = String(input.artifact.content ?? "").trim();
  const quality = evaluateArtifactContentQuality({
    artifactType: input.artifact.type,
    content,
  });
  const meta: ProjectArtifactOrchestrationMeta = {
    reason: input.planRow.reason,
    required: input.planRow.required,
    confidence: input.planRow.confidence * (quality.isPlaceholderOnly ? 0.5 : 1),
    sourceRoles: input.planRow.sourceRoles.map((r) => roleLabel(r)),
    sourceSlotKeys: input.planRow.sourceSlotKeys,
    trace: buildArtifactTraceForPlannedRow(input.planRow, input.conversationMessages),
    completenessScore: quality.completenessScore,
    hubReadinessLabel: quality.hubReadinessLabel,
    ...(quality.improvementHint ? { improvementHint: quality.improvementHint } : {}),
    isPlaceholderOnly: quality.isPlaceholderOnly,
    serviceProfile: input.serviceProfile,
    plannedAt: input.nowIso,
  };
  return { ...input.artifact, orchestration: meta };
}

export function artifactHasMeaningfulContent(artifact: ProjectArtifact): boolean {
  const content = String(artifact.content ?? "").trim();
  if (artifact.orchestration?.isPlaceholderOnly) return false;
  if (isPlaceholderOnlyArtifactContent(content)) return false;
  if ((artifact.orchestration?.completenessScore ?? 0) < 0.55) return false;
  return content.length >= 24;
}

export function evaluateArtifactOrchestrationReadiness(input: {
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
  readonly requiredTypes: readonly ProjectArtifactType[];
  readonly minCompleteness?: number;
}): Readonly<{
  readonly ready: boolean;
  readonly missingRequiredArtifactTypes: readonly ProjectArtifactType[];
  readonly missingRequiredArtifactLabels: readonly string[];
  readonly weakTraceTypes: readonly ProjectArtifactType[];
  readonly lowCompletenessTypes: readonly ProjectArtifactType[];
  readonly missingMemberRoles: readonly string[];
}> {
  const artifacts = input.projectArtifacts ?? [];
  const minCompleteness = input.minCompleteness ?? 0.55;
  const missingTypes: ProjectArtifactType[] = [];
  const missingLabels: string[] = [];
  const weakTrace: ProjectArtifactType[] = [];
  const lowCompleteness: ProjectArtifactType[] = [];
  const rolesNeeded = new Set<string>();

  for (const type of input.requiredTypes) {
    const row = artifacts.find((a) => a.type === type && artifactHasMeaningfulContent(a));
    if (!row) {
      missingTypes.push(type);
      missingLabels.push(PROJECT_ARTIFACT_LABELS[type] ?? type);
      continue;
    }
    const orch = row.orchestration;
    if (!orch?.trace?.length) weakTrace.push(type);
    if ((orch?.completenessScore ?? 0) < minCompleteness) lowCompleteness.push(type);
    for (const r of orch?.sourceRoles ?? []) rolesNeeded.add(r);
  }

  const rolesPresent = new Set(
    artifacts.flatMap((a) => a.orchestration?.sourceRoles ?? []),
  );
  const missingMemberRoles = [...rolesNeeded].filter((r) => !rolesPresent.has(r));

  const ready =
    missingTypes.length === 0 && weakTrace.length === 0 && lowCompleteness.length === 0;

  return {
    ready,
    missingRequiredArtifactTypes: missingTypes,
    missingRequiredArtifactLabels: missingLabels,
    weakTraceTypes: weakTrace,
    lowCompletenessTypes: lowCompleteness,
    missingMemberRoles,
  };
}

export function parseArtifactOrchestrationStateV1(raw: unknown): ArtifactOrchestrationStateV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const plannedAt = String(o.plannedAt ?? "").trim();
  if (!plannedAt) return null;
  const serviceProfile = String(o.serviceProfile ?? "standard") as ArtifactServiceProfile;
  const requiredTypes = Array.isArray(o.requiredTypes)
    ? o.requiredTypes.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const planned: OrchestratedPlannedArtifact[] = [];
  if (Array.isArray(o.planned)) {
    for (const row of o.planned) {
      if (!row || typeof row !== "object") continue;
      const p = row as Record<string, unknown>;
      const type = String(p.type ?? "").trim() as ProjectArtifactType;
      if (!type || !(type in PROJECT_ARTIFACT_LABELS)) continue;
      planned.push({
        type,
        title: String(p.title ?? PROJECT_ARTIFACT_LABELS[type]).trim(),
        required: Boolean(p.required),
        reason: String(p.reason ?? "").trim() || "AI팀 판단",
        sourceRoles: Array.isArray(p.sourceRoles)
          ? (p.sourceRoles.map((r) => String(r).trim()).filter(Boolean) as PlatformMemberRole[])
          : [],
        sourceSlotKeys: Array.isArray(p.sourceSlotKeys) ? p.sourceSlotKeys.map((k) => String(k).trim()).filter(Boolean) : [],
        confidence: Number(p.confidence) || 0.7,
      });
    }
  }
  return {
    plannedAt,
    serviceProfile,
    requiredTypes: requiredTypes as ProjectArtifactType[],
    planned,
    memberRoles: Array.isArray(o.memberRoles)
      ? (o.memberRoles.map((r) => String(r).trim()).filter(Boolean) as PlatformMemberRole[])
      : [],
    planningSummary: String(o.planningSummary ?? "").trim(),
  };
}
