import {
  artifactHasMeaningfulContent,
  evaluateArtifactOrchestrationReadiness,
  type ArtifactOrchestrationStateV1,
} from "@/lib/requirements/artifactOrchestration";
import {
  FALLBACK_IMPLEMENTATION_ARTIFACT_TYPES,
  LEGACY_QUICK_DESIGN_AREA_TITLES,
} from "@/lib/requirements/projectArtifactPlan";
import {
  PROJECT_ARTIFACT_LABELS,
  type ProjectArtifact,
  type ProjectArtifactType,
} from "@/lib/requirements/projectArtifactTypes";
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
}): ImplementationStartReadiness {
  const slots = evaluatePlanningToGenerationReadiness(input);
  const requiredTypes = resolveRequiredImplementationArtifactTypes(input);
  const artifacts = evaluateRequiredImplementationArtifacts({
    projectArtifacts: input.projectArtifacts,
    requiredTypes,
    artifactOrchestrationV1: input.artifactOrchestrationV1,
  });

  if (slots.ready && artifacts.ready) {
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
  if (!artifacts.ready) {
    if (artifacts.missingRequiredArtifactLabels.length) {
      const preview = artifacts.missingRequiredArtifactLabels.slice(0, 6).join(", ");
      parts.push(`필수 산출물이 아직 준비되지 않았습니다. 부족: ${preview}`);
    } else if (artifacts.orchestrationDetail.weakTraceTypes.length) {
      parts.push("산출물 추적 정보(관련 슬롯·AI멤버)가 부족합니다. Quick Design 확정을 다시 실행해 주세요.");
    } else if (artifacts.orchestrationDetail.lowCompletenessTypes.length) {
      parts.push("산출물 본문이 아직 충분하지 않습니다. Artifact Hub에서 내용을 보완해 주세요.");
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
