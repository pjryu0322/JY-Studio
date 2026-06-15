import type { FeaturePlanningPrototypeReadinessV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import {
  evaluateSampleDataSpecReadiness,
  parseSampleDataSpecV1,
  resolveSampleDataSpecV1ForPlanning,
  type SampleDataReadinessV1,
  type SampleDataSpecV1,
} from "@/lib/featurePlanning/sampleDataSpecV1";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

export type FeaturePlanningPrototypeReadinessWithSampleDataV1 = FeaturePlanningPrototypeReadinessV1 &
  Readonly<{
    readonly sampleDataReadiness?: SampleDataReadinessV1;
  }>;

export function applySampleDataSpecToPrototypeReadiness(input: Readonly<{
  readonly prototypeReadiness: FeaturePlanningPrototypeReadinessV1;
  readonly sampleDataSpec: SampleDataSpecV1 | null;
}>): FeaturePlanningPrototypeReadinessWithSampleDataV1 {
  const sampleDataReadiness = evaluateSampleDataSpecReadiness(input.sampleDataSpec);
  const missingItems = [...input.prototypeReadiness.missingItems];
  let status = input.prototypeReadiness.status;

  if (sampleDataReadiness.status === "INSUFFICIENT") {
    status = "INSUFFICIENT";
    if (!missingItems.includes("sampleDataSpecV1")) missingItems.push("sampleDataSpecV1");
    for (const key of sampleDataReadiness.missingEntities.slice(0, 6)) {
      const line = `sampleData:${key}`;
      if (!missingItems.includes(line)) missingItems.push(line);
    }
  } else if (sampleDataReadiness.status === "NEEDS_REVIEW" && status === "READY") {
    status = "NEEDS_REVIEW";
  } else if (sampleDataReadiness.status !== "READY" && status === "READY") {
    status = "NEEDS_REVIEW";
  }

  if (status === "READY" && sampleDataReadiness.status !== "READY") {
    status = sampleDataReadiness.status;
  }

  const notes = [input.prototypeReadiness.notes, sampleDataReadiness.notes].filter(Boolean).join(" ").trim();

  return {
    status,
    missingItems: missingItems.slice(0, 48),
    notes: notes.slice(0, 4000),
    sampleDataReadiness,
  };
}

export function syncFeaturePlanningSampleDataState(input: Readonly<{
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly existingSpecRaw?: unknown;
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
}>): Readonly<{
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly sampleDataSpecV1: SampleDataSpecV1;
}> {
  const existingSpec = parseSampleDataSpecV1(input.existingSpecRaw);
  const sampleDataSpecV1 = resolveSampleDataSpecV1ForPlanning({
    existingSpec,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
  });
  const prototypeReadiness = applySampleDataSpecToPrototypeReadiness({
    prototypeReadiness: input.artifact.prototypeReadiness,
    sampleDataSpec: sampleDataSpecV1,
  });
  return {
    artifact: { ...input.artifact, prototypeReadiness },
    sampleDataSpecV1,
  };
}

const SAMPLE_DATA_CHECKLIST_AREA_KEY = "sample_data_preview";

export function ensureSampleDataChecklistArea(
  checklist: import("@/lib/featurePlanning/featurePlanningPlanningChecklistTypes").FeaturePlanningPlanningChecklistV1,
): import("@/lib/featurePlanning/featurePlanningPlanningChecklistTypes").FeaturePlanningPlanningChecklistV1 {
  if (checklist.areas.some((a) => a.areaKey === SAMPLE_DATA_CHECKLIST_AREA_KEY)) return checklist;
  return { ...checklist, areas: [...checklist.areas, buildSampleDataPlanningChecklistArea()] };
}

/** 기능정리 저장 시 requirements state에 넣을 artifact + sampleDataSpecV1. */
export function bundleFeaturePlanningSampleDataPersist(input: Readonly<{
  readonly artifact: FeaturePlanningSlotsArtifactV1;
  readonly existingSpecRaw?: unknown;
  readonly projectName?: string | null;
  readonly projectDescription?: string | null;
}>): Readonly<{
  readonly featurePlanningSlotsV1: FeaturePlanningSlotsArtifactV1;
  readonly sampleDataSpecV1: SampleDataSpecV1;
}> {
  const synced = syncFeaturePlanningSampleDataState(input);
  return {
    featurePlanningSlotsV1: synced.artifact,
    sampleDataSpecV1: synced.sampleDataSpecV1,
  };
}

export function buildSampleDataPlanningChecklistArea(): import("@/lib/featurePlanning/featurePlanningPlanningChecklistTypes").FeaturePlanningChecklistAreaV1 {
  return {
    areaKey: SAMPLE_DATA_CHECKLIST_AREA_KEY,
    title: "Preview 샘플데이터",
    purpose: "Preview 검토용 샘플데이터 기준(수량·상태·시나리오)을 확정합니다.",
    requiredScore: 85,
    slots: [
      {
        slotKey: "sample_data_purpose",
        label: "Preview 확인 목적",
        required: true,
        priority: "HIGH",
        question:
          "Preview에서 사용자가 반드시 확인해야 할 핵심 데이터는 무엇인가요? (회의 파일·참여자·요약·상태 등)",
      },
      {
        slotKey: "sample_data_minimum_counts",
        label: "최소 데이터 수량",
        required: true,
        priority: "HIGH",
        question: "각 데이터는 최소 몇 개가 화면에 보여야 하나요? (예: 회의 파일 5개, 참여자 5명)",
      },
      {
        slotKey: "sample_data_statuses",
        label: "필수 상태값",
        required: true,
        priority: "HIGH",
        question: "어떤 상태값이 화면에 구분되어 보여야 하나요? (정상/처리중/실패/빈 상태 등)",
      },
      {
        slotKey: "sample_data_scenarios",
        label: "필수 시나리오",
        required: true,
        priority: "MEDIUM",
        question: "정상·처리중·실패·다운로드 가능·빈 상태 중 Preview에 꼭 필요한 시나리오는 무엇인가요?",
      },
      {
        slotKey: "sample_data_validation",
        label: "Preview 확인 기준",
        required: true,
        priority: "MEDIUM",
        question: "샘플데이터가 부족하면 어떤 화면 판단이 불가능한가요? Preview에서 확인할 체크리스트를 적어 주세요.",
      },
    ],
  };
}
