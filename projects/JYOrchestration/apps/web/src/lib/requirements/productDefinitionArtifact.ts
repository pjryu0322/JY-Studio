import type { ProductDefinitionV1 } from "@/lib/requirements/productDefinitionV1";
import { PRODUCT_DEFINITION_NEEDS_CONFIRMATION } from "@/lib/requirements/productDefinitionV1";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { parseProjectArtifactsFromState } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export const PRODUCT_DEFINITION_ARTIFACT_ID = "artifact_product_definition_v1" as const;
export const PRODUCT_DEFINITION_ARTIFACT_TYPE = "product-definition" as const;

function fieldLine(label: string, value: string): string {
  const v = value.trim() || PRODUCT_DEFINITION_NEEDS_CONFIRMATION;
  return `- ${label}: ${v}`;
}

export function formatProductDefinitionMarkdown(def: ProductDefinitionV1): string {
  const features = def.coreFeatures.items.length
    ? def.coreFeatures.items.map((f, i) => `${i + 1}. ${f}`).join("\n")
    : PRODUCT_DEFINITION_NEEDS_CONFIRMATION;

  return [
    "# Product Definition",
    "",
    "## 제품 개요",
    fieldLine("제품명", def.overview.productName),
    fieldLine("한 줄 소개", def.overview.oneLineIntro.value),
    fieldLine("제품 목적", def.overview.productPurpose.value),
    fieldLine("해결 문제", def.overview.problemToSolve.value),
    "",
    "## 대상 사용자",
    fieldLine("주요 사용자", def.targetUsers.primaryUsers.value),
    fieldLine("이해관계자", def.targetUsers.stakeholders.value),
    fieldLine("사용자 역할", def.targetUsers.userRoles.value),
    "",
    "## 제품 범위",
    fieldLine("포함 범위", def.scope.scopeIn.value),
    fieldLine("제외 범위", def.scope.scopeOut.value),
    fieldLine("향후 확장 범위", def.scope.futureScope.value),
    "",
    "## 핵심 가치",
    fieldLine("사용자 가치", def.coreValue.userValue.value),
    fieldLine("차별성", def.coreValue.differentiation.value),
    "",
    "## 핵심 업무 시나리오",
    def.coreWorkScenarios.value,
    "",
    "## 핵심 기능",
    features,
    "",
    "## 외부 연동",
    def.externalIntegrations.value,
    "",
    "## 성공 기준",
    def.successCriteria.value,
    "",
    "## 구현 난이도",
    `- 수준: ${def.implementationDifficulty}`,
    fieldLine("비고", def.implementationDifficultyNotes.value),
    "",
    "## 주요 리스크",
    def.majorRisks.value,
    "",
    "## 제품화 — 조직·운영",
    fieldLine("조직 모델", def.productModel.organizationModel.value),
    fieldLine("가격 모델", def.productModel.pricingModel.value),
    fieldLine("운영 모델", def.productModel.operatingModel.value),
    "",
    "## 제품화 — 데이터 정책",
    fieldLine("데이터 민감도", def.dataPolicy.dataSensitivity.value),
    fieldLine("보관 정책", def.dataPolicy.retentionPolicy.value),
    fieldLine("동의 정책", def.dataPolicy.consentPolicy.value),
    "",
    "## 제품화 — 품질 목표",
    fieldLine("가용성 목표", def.qualityPolicy.availabilityTarget.value),
    fieldLine("성능 목표", def.qualityPolicy.performanceTarget.value),
    fieldLine("복구 정책", def.qualityPolicy.recoveryPolicy.value),
    ...(def.completedAt ? ["", `확정 시각: ${def.completedAt}`] : []),
  ].join("\n");
}

export function upsertProductDefinitionArtifact(
  prior: readonly ProjectArtifact[] | null | undefined,
  def: ProductDefinitionV1,
  nowIso: string,
): readonly ProjectArtifact[] {
  const list = [...(prior ?? [])];
  const idx = list.findIndex(
    (a) => a.id === PRODUCT_DEFINITION_ARTIFACT_ID || a.type === PRODUCT_DEFINITION_ARTIFACT_TYPE,
  );
  const artifact: ProjectArtifact = {
    id: PRODUCT_DEFINITION_ARTIFACT_ID,
    type: PRODUCT_DEFINITION_ARTIFACT_TYPE,
    title: "Product Definition",
    createdAt: idx >= 0 ? list[idx]!.createdAt : nowIso,
    createdBy: "ai",
    sourceStage: "PRODUCT_DEFINITION",
    content: formatProductDefinitionMarkdown(def),
  };
  if (idx >= 0) {
    list[idx] = artifact;
    return list;
  }
  return [...list, artifact];
}

export function mergeProductDefinitionIntoRequirementsState(
  base: RequirementsStateJson,
  def: ProductDefinitionV1,
  nowIso?: string,
): RequirementsStateJson {
  const now = nowIso ?? def.updatedAt ?? new Date().toISOString();
  const prior = parseProjectArtifactsFromState(base.projectArtifacts) ?? [];
  return {
    ...base,
    productDefinitionV1: def,
    projectArtifacts: upsertProductDefinitionArtifact(prior, def, now),
  };
}
