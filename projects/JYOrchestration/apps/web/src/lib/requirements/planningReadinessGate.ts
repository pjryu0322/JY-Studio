import {
  artifactHasMeaningfulContent,
  evaluateArtifactOrchestrationReadiness,
  type ArtifactOrchestrationStateV1,
} from "@/lib/requirements/artifactOrchestration";
import { improvementHintForType } from "@/lib/requirements/artifactContentGeneration";
import {
  FALLBACK_IMPLEMENTATION_ARTIFACT_TYPES,
  LEGACY_QUICK_DESIGN_AREA_TITLES,
} from "@/lib/requirements/projectArtifactPlan";
import {
  PROJECT_ARTIFACT_LABELS,
  type ProjectArtifact,
  type ProjectArtifactType,
} from "@/lib/requirements/projectArtifactTypes";
import {
  evaluateImplementationSeedReadiness,
  IMPLEMENTATION_SEED_GAP_LABELS,
  type ImplementationSeedReadiness,
} from "@/lib/requirements/implementationSeed";
import { findOrchestrationSlotKeysBySuffix, findSlotRow } from "@/lib/requirements/singleChatSlotNextAction";
import { normalizeSlotStatus } from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

const REQUIRED_SUFFIXES_FOR_GENERATION: readonly string[] = [
  ".planning.servicePurpose",
  ".planning.coreUsers",
  ".planning.problem",
  ".planning.expectedOutcome",
  ".flow.actorTypes",
  ".flow.serviceFlow",
  ".design.coreFeatures",
  ".design.requiredScreens",
];

const SUFFIX_LABEL: Readonly<Record<string, string>> = {
  ".planning.servicePurpose": "서비스 목적",
  ".planning.coreUsers": "주 사용자",
  ".planning.problem": "핵심 문제",
  ".planning.expectedOutcome": "기대 효과",
  ".planning.coreValue": "기대 효과",
  ".flow.actorTypes": "주요 액터",
  ".flow.serviceFlow": "서비스 흐름",
  ".design.coreFeatures": "MVP 기능 후보",
  ".design.requiredScreens": "주요 화면 후보",
};

export type PlanningToGenerationReadiness = Readonly<{
  readonly ready: boolean;
  readonly missingRequiredSlotKeys: readonly string[];
  readonly missingRequiredLabels: readonly string[];
  readonly missingRequiredArtifactTypes: readonly ProjectArtifactType[];
  readonly missingRequiredArtifactLabels: readonly string[];
  readonly reason: string | null;
}>;

export type ImplementationStartReadiness = PlanningToGenerationReadiness;

/** Planning Minimum Gate — Quick Design / 기획 산출물 생성 (기존 동작 유지) */
export type PlanningMinimumReadiness = PlanningToGenerationReadiness;

/** Implementation Seed Gate — 구현 작업안 초안 생성 가능 여부 */
export type ImplementationSeedGateReadiness = ImplementationSeedReadiness & Readonly<{
  readonly reason: string | null;
}>;

export type GenerationReadinessBlockerKind =
  | "implementation_seed"
  | "database"
  | "artifact"
  | "planning_slot";

export type GenerationReadinessBlocker = Readonly<{
  readonly kind: GenerationReadinessBlockerKind;
  readonly status: "blocked" | "ready" | "warning";
  readonly title: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly actionKind?:
    | "CONFIRM_IMPLEMENTATION_SEED"
    | "OPEN_PLANNING_DATABASE_SETTINGS"
    | "VIEW_MISSING_ITEMS";
}>;

export function buildImplementationStartReadinessBlockers(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly databaseReady?: boolean | null;
  readonly databaseMessage?: string | null;
}): readonly GenerationReadinessBlocker[] {
  const slots = evaluatePlanningToGenerationReadiness(input);
  const requiredTypes = resolveRequiredImplementationArtifactTypes(input);
  const artifacts = evaluateRequiredImplementationArtifacts({
    projectArtifacts: input.projectArtifacts,
    requiredTypes,
    artifactOrchestrationV1: input.artifactOrchestrationV1,
  });
  const seedReadiness = evaluateImplementationSeedReadiness({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });

  const blockers: GenerationReadinessBlocker[] = [];

  if (!slots.ready) {
    blockers.push({
      kind: "planning_slot",
      status: "blocked",
      title: "기획 필수 슬롯",
      message: slots.reason ?? "필수 기획 슬롯이 확정되지 않았습니다.",
      actionKind: "VIEW_MISSING_ITEMS",
    });
  }

  blockers.push({
    kind: "implementation_seed",
    status: seedReadiness.ready ? "ready" : "blocked",
    title: "Implementation Seed",
    message: seedReadiness.ready
      ? "Implementation Seed가 준비되었습니다."
      : seedReadiness.missing.length
        ? `Implementation Seed 확정이 필요합니다. (필수 ${seedReadiness.missing.length}개 미충족)`
        : "Implementation Seed 확정이 필요합니다. 후보·partial 상태 항목을 확정해 주세요.",
    actionLabel: seedReadiness.ready ? undefined : "Implementation Seed 확정",
    actionKind: seedReadiness.ready ? undefined : "CONFIRM_IMPLEMENTATION_SEED",
  });

  if (input.databaseReady === false) {
    blockers.push({
      kind: "database",
      status: "blocked",
      title: "프로젝트 DB",
      message:
        input.databaseMessage ??
        "프로젝트 DB 설정이 완료되지 않아 구현단계로 이동할 수 없습니다.",
      actionLabel: "데이터베이스 설정하기",
      actionKind: "OPEN_PLANNING_DATABASE_SETTINGS",
    });
  } else if (input.databaseReady === true) {
    blockers.push({
      kind: "database",
      status: "ready",
      title: "프로젝트 DB",
      message: "프로젝트 DB가 준비되었습니다.",
    });
  }

  if (!artifacts.ready) {
    const artMsg = artifacts.missingRequiredArtifactLabels.length
      ? `필수 산출물이 아직 준비되지 않았습니다. 부족: ${artifacts.missingRequiredArtifactLabels.slice(0, 5).join(", ")}`
      : "필수 산출물이 아직 준비되지 않았습니다.";
    blockers.push({
      kind: "artifact",
      status: "blocked",
      title: "필수 산출물",
      message: artMsg,
      actionKind: "VIEW_MISSING_ITEMS",
    });
  }

  return blockers;
}

export function formatImplementationStartReadinessUserMessage(
  blockers: readonly GenerationReadinessBlocker[],
): string {
  const blocked = blockers.filter((b) => b.status === "blocked");
  if (!blocked.length) {
    return "구현단계로 이동할 수 있습니다.";
  }

  const seedBlocked = blocked.some((b) => b.kind === "implementation_seed");
  const dbBlocked = blocked.some((b) => b.kind === "database");
  if (seedBlocked && dbBlocked) {
    const lines = [
      "구현단계 이동 전 확인이 필요합니다.",
      "",
      "1. Implementation Seed",
      "- 상태: 미확정",
      "- 필요한 작업: Implementation Seed 확정",
      "",
      "2. 프로젝트 DB",
      "- 상태: 준비 실패",
      "- 필요한 작업: DB 설정 열기",
      "",
      "Seed를 먼저 확정한 뒤 DB 설정을 확인해 주세요.",
    ];
    return lines.join("\n");
  }

  if (seedBlocked && !dbBlocked) {
    return [
      "Implementation Seed 확정이 필요합니다.",
      blocked.find((b) => b.kind === "implementation_seed")?.message ?? "",
      "",
      "채팅에서 Implementation Seed 확정을 선택해 주세요.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (dbBlocked && !seedBlocked) {
    return [
      "Implementation Seed는 준비되었습니다.",
      "프로젝트 DB 설정이 완료되지 않아 구현단계로 이동할 수 없습니다.",
      "데이터베이스 설정하기에서 연결을 확인해 주세요.",
    ].join("\n");
  }

  return blocked.map((b) => b.message).join(" ");
}

export function evaluatePlanningMinimumReadiness(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): PlanningMinimumReadiness {
  return evaluatePlanningToGenerationReadiness(input);
}

export function evaluateImplementationSeedGateReadiness(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): ImplementationSeedGateReadiness {
  const seed = evaluateImplementationSeedReadiness(input);
  if (seed.ready) {
    return { ...seed, reason: null };
  }
  const labels = seed.missing.map((k) => IMPLEMENTATION_SEED_GAP_LABELS[k]);
  const preview = labels.slice(0, 5).join(", ");
  return {
    ...seed,
    reason: `구현 작업안 초안을 위해 제품화 수준 기획 정보가 부족합니다. 부족: ${preview}${labels.length > 5 ? " …" : ""}`,
  };
}

export function resolveRequiredImplementationArtifactTypes(input: {
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
}): readonly ProjectArtifactType[] {
  const fromState = input.artifactOrchestrationV1?.requiredTypes;
  if (fromState?.length) return fromState;
  const fromArtifacts = [
    ...new Set(
      (input.projectArtifacts ?? [])
        .filter((a) => a.orchestration?.required && artifactHasMeaningfulContent(a))
        .map((a) => a.type),
    ),
  ] as ProjectArtifactType[];
  if (fromArtifacts.length) return fromArtifacts;
  return FALLBACK_IMPLEMENTATION_ARTIFACT_TYPES;
}

export function evaluateRequiredImplementationArtifacts(input: {
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
  readonly requiredTypes?: readonly ProjectArtifactType[];
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
}): Readonly<{
  readonly ready: boolean;
  readonly missingRequiredArtifactTypes: readonly ProjectArtifactType[];
  readonly missingRequiredArtifactLabels: readonly string[];
  readonly orchestrationReady: boolean;
  readonly orchestrationDetail: ReturnType<typeof evaluateArtifactOrchestrationReadiness>;
}> {
  const requiredTypes = input.requiredTypes ?? resolveRequiredImplementationArtifactTypes(input);
  const artifacts = (input.projectArtifacts ?? []).filter((a) => {
    if (LEGACY_QUICK_DESIGN_AREA_TITLES.has(String(a.title ?? "").trim())) return false;
    return true;
  });
  const orchDetail = evaluateArtifactOrchestrationReadiness({
    projectArtifacts: artifacts,
    requiredTypes,
  });
  const missingTypes = orchDetail.missingRequiredArtifactTypes;
  const missingLabels = orchDetail.missingRequiredArtifactLabels;
  return {
    ready: missingTypes.length === 0 && orchDetail.ready,
    missingRequiredArtifactTypes: missingTypes,
    missingRequiredArtifactLabels: missingLabels,
    orchestrationReady: orchDetail.ready,
    orchestrationDetail: orchDetail,
  };
}

export function evaluateImplementationStartReadiness(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly databaseReady?: boolean | null;
  readonly databaseMessage?: string | null;
}): ImplementationStartReadiness {
  const slots = evaluatePlanningToGenerationReadiness(input);
  const requiredTypes = resolveRequiredImplementationArtifactTypes(input);
  const artifacts = evaluateRequiredImplementationArtifacts({
    projectArtifacts: input.projectArtifacts,
    requiredTypes,
    artifactOrchestrationV1: input.artifactOrchestrationV1,
  });

  const seedReadiness = evaluateImplementationSeedReadiness({
    orchestration: input.orchestration,
    definitions: input.definitions,
  });

  if (slots.ready && artifacts.ready && seedReadiness.ready) {
    if (input.databaseReady === false) {
      const blockers = buildImplementationStartReadinessBlockers(input);
      return {
        ready: false,
        missingRequiredSlotKeys: [],
        missingRequiredLabels: [],
        missingRequiredArtifactTypes: [],
        missingRequiredArtifactLabels: [],
        reason: formatImplementationStartReadinessUserMessage(blockers),
      };
    }
    return {
      ready: true,
      missingRequiredSlotKeys: [],
      missingRequiredLabels: [],
      missingRequiredArtifactTypes: [],
      missingRequiredArtifactLabels: [],
      reason: null,
    };
  }

  const parts: string[] = [];
  if (!slots.ready && slots.reason) parts.push(slots.reason);
  if (slots.ready && artifacts.ready && !seedReadiness.ready) {
    const seedLabels = [
      ...seedReadiness.missing.map((k) => IMPLEMENTATION_SEED_GAP_LABELS[k]),
      ...seedReadiness.warnings,
    ];
    const preview = seedLabels.slice(0, 6).join(", ");
    const blockers = buildImplementationStartReadinessBlockers(input);
    const splitReason = formatImplementationStartReadinessUserMessage(blockers);
    parts.push(
      splitReason.length > 40
        ? splitReason
        : preview.length
          ? `구현 단계로 이동하려면 Implementation Seed가 준비되어야 합니다. 부족: ${preview} — Implementation Seed 확정이 필요합니다.`
          : "구현 단계로 이동하려면 Implementation Seed 확정이 필요합니다.",
    );
  }
  if (!artifacts.ready) {
    if (artifacts.missingRequiredArtifactLabels.length) {
      const preview = artifacts.missingRequiredArtifactLabels.slice(0, 6).join(", ");
      parts.push(`필수 산출물이 아직 준비되지 않았습니다. 부족: ${preview}`);
    } else if (artifacts.orchestrationDetail.weakTraceTypes.length) {
      parts.push("산출물 추적 정보(관련 슬롯·AI멤버)가 부족합니다. Quick Design 확정을 다시 실행해 주세요.");
    } else if (artifacts.orchestrationDetail.lowCompletenessTypes.length) {
      const lowType = artifacts.orchestrationDetail.lowCompletenessTypes[0];
      const lowArt = (input.projectArtifacts ?? []).find(
        (a) => a.type === lowType && a.orchestration?.improvementHint,
      );
      const hint =
        lowArt?.orchestration?.improvementHint ??
        (lowType ? improvementHintForType(lowType) : null);
      parts.push(
        hint ?? "산출물 본문이 아직 충분하지 않습니다. Artifact Hub에서 내용을 보완해 주세요.",
      );
    } else {
      parts.push("필수 산출물이 아직 준비되지 않았습니다.");
    }
  }

  return {
    ready: false,
    missingRequiredSlotKeys: slots.missingRequiredSlotKeys,
    missingRequiredLabels: slots.missingRequiredLabels,
    missingRequiredArtifactTypes: artifacts.missingRequiredArtifactTypes,
    missingRequiredArtifactLabels: artifacts.missingRequiredArtifactLabels,
    reason: parts.join(" "),
  };
}

export function evaluatePlanningToGenerationReadiness(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
}): PlanningToGenerationReadiness {
  const missingKeys: string[] = [];
  const missingLabels: string[] = [];

  for (const suffix of REQUIRED_SUFFIXES_FOR_GENERATION) {
    const key = findOrchestrationSlotKeysBySuffix(input.definitions, suffix)[0];
    if (!key) continue;
    const row = findSlotRow(input.orchestration, key);
    const status = normalizeSlotStatus(String(row?.status ?? "empty"));
    const value = String(row?.value ?? "").trim();
    if (status !== "confirmed" || value.length < 4) {
      missingKeys.push(key);
      missingLabels.push(SUFFIX_LABEL[suffix] ?? row?.label ?? key);
    }
  }

  if (!missingKeys.length) {
    return {
      ready: true,
      missingRequiredSlotKeys: [],
      missingRequiredLabels: [],
      missingRequiredArtifactTypes: [],
      missingRequiredArtifactLabels: [],
      reason: null,
    };
  }

  const preview = missingLabels.slice(0, 6).join(", ");
  return {
    ready: false,
    missingRequiredSlotKeys: missingKeys,
    missingRequiredLabels: missingLabels,
    missingRequiredArtifactTypes: [],
    missingRequiredArtifactLabels: [],
    reason: `구현 단계로 이동하려면 필수 슬롯을 먼저 확정해 주세요. 부족: ${preview}${missingLabels.length > 6 ? " …" : ""}`,
  };
}
