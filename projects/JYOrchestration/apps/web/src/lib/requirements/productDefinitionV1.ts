/**
 * Product Definition — 프로젝트 생성 직후 제품 방향·범위 산출물 (`requirementsStateJson.productDefinitionV1`).
 */

import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";

export const PRODUCT_DEFINITION_VERSION = 1 as const;
export const PRODUCT_DEFINITION_NEEDS_CONFIRMATION = "추가 확인 필요" as const;

export type ProductDefinitionFieldConfidence = "confirmed" | "needs_confirmation";

export type ProductDefinitionTextFieldV1 = Readonly<{
  readonly value: string;
  readonly confidence: ProductDefinitionFieldConfidence;
}>;

export type ProductDefinitionDifficultyV1 = "Low" | "Medium" | "High" | "needs_confirmation";

export type ProductDefinitionV1 = Readonly<{
  readonly version: typeof PRODUCT_DEFINITION_VERSION;
  readonly updatedAt: string;
  readonly completedAt?: string | null;
  readonly overview: Readonly<{
    readonly productName: string;
    readonly oneLineIntro: ProductDefinitionTextFieldV1;
    readonly productPurpose: ProductDefinitionTextFieldV1;
    readonly problemToSolve: ProductDefinitionTextFieldV1;
  }>;
  readonly targetUsers: Readonly<{
    readonly primaryUsers: ProductDefinitionTextFieldV1;
    readonly stakeholders: ProductDefinitionTextFieldV1;
    readonly userRoles: ProductDefinitionTextFieldV1;
  }>;
  readonly scope: Readonly<{
    readonly scopeIn: ProductDefinitionTextFieldV1;
    readonly scopeOut: ProductDefinitionTextFieldV1;
    readonly futureScope: ProductDefinitionTextFieldV1;
  }>;
  readonly coreValue: Readonly<{
    readonly userValue: ProductDefinitionTextFieldV1;
    readonly differentiation: ProductDefinitionTextFieldV1;
  }>;
  readonly coreWorkScenarios: ProductDefinitionTextFieldV1;
  readonly coreFeatures: Readonly<{
    readonly items: readonly string[];
    readonly confidence: ProductDefinitionFieldConfidence;
  }>;
  readonly externalIntegrations: ProductDefinitionTextFieldV1;
  readonly successCriteria: ProductDefinitionTextFieldV1;
  readonly implementationDifficulty: ProductDefinitionDifficultyV1;
  readonly implementationDifficultyNotes: ProductDefinitionTextFieldV1;
  readonly majorRisks: ProductDefinitionTextFieldV1;
  readonly productModel: Readonly<{
    readonly organizationModel: ProductDefinitionTextFieldV1;
    readonly pricingModel: ProductDefinitionTextFieldV1;
    readonly operatingModel: ProductDefinitionTextFieldV1;
  }>;
  readonly dataPolicy: Readonly<{
    readonly dataSensitivity: ProductDefinitionTextFieldV1;
    readonly retentionPolicy: ProductDefinitionTextFieldV1;
    readonly consentPolicy: ProductDefinitionTextFieldV1;
  }>;
  readonly qualityPolicy: Readonly<{
    readonly availabilityTarget: ProductDefinitionTextFieldV1;
    readonly performanceTarget: ProductDefinitionTextFieldV1;
    readonly recoveryPolicy: ProductDefinitionTextFieldV1;
  }>;
}>;

export type ProductDefinitionReadinessV1 = Readonly<{
  readonly ready: boolean;
  readonly missing: readonly string[];
}>;

function readStr(value: unknown, max = 8000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseField(raw: unknown): ProductDefinitionTextFieldV1 {
  if (!raw || typeof raw !== "object") {
    return { value: PRODUCT_DEFINITION_NEEDS_CONFIRMATION, confidence: "needs_confirmation" };
  }
  const o = raw as Record<string, unknown>;
  const value = readStr(o.value, 8000) || PRODUCT_DEFINITION_NEEDS_CONFIRMATION;
  const confRaw = readStr(o.confidence, 40);
  const confidence: ProductDefinitionFieldConfidence =
    confRaw === "confirmed" ? "confirmed" : "needs_confirmation";
  return { value, confidence };
}

function fieldFromText(text: string, confirmed: boolean): ProductDefinitionTextFieldV1 {
  const value = text.trim() || PRODUCT_DEFINITION_NEEDS_CONFIRMATION;
  if (!text.trim()) {
    return { value: PRODUCT_DEFINITION_NEEDS_CONFIRMATION, confidence: "needs_confirmation" };
  }
  return { value, confidence: confirmed ? "confirmed" : "needs_confirmation" };
}

function parseFieldGroup(
  raw: unknown,
  keys: readonly string[],
): Record<string, ProductDefinitionTextFieldV1> {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(keys.map((k) => [k, parseField(o[k])]));
}

export function defaultProductizationFields(): Pick<
  ProductDefinitionV1,
  "productModel" | "dataPolicy" | "qualityPolicy"
> {
  const empty = () => fieldFromText("", false);
  return {
    productModel: {
      organizationModel: empty(),
      pricingModel: empty(),
      operatingModel: empty(),
    },
    dataPolicy: {
      dataSensitivity: empty(),
      retentionPolicy: empty(),
      consentPolicy: empty(),
    },
    qualityPolicy: {
      availabilityTarget: empty(),
      performanceTarget: empty(),
      recoveryPolicy: empty(),
    },
  };
}

const DATA_POLICY_KEYWORD =
  /데이터|파일|음성|녹음|회의|사용자|권한|개인정보|결제|업로드|api|storage|stt|transcript|녹취|참석|민감/i;

export function requiresDataPolicyConfirmation(def: ProductDefinitionV1): boolean {
  if (def.externalIntegrations.confidence === "confirmed") return true;
  const hay = [
    def.scope.scopeIn.value,
    def.overview.problemToSolve.value,
    def.overview.productPurpose.value,
    ...def.coreFeatures.items,
  ].join(" ");
  return DATA_POLICY_KEYWORD.test(hay);
}

export function parseProductDefinitionV1(raw: unknown): ProductDefinitionV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== PRODUCT_DEFINITION_VERSION) return null;
  const updatedAt = readStr(o.updatedAt, 80);
  if (!updatedAt) return null;

  const overviewRaw = o.overview;
  const targetRaw = o.targetUsers;
  const scopeRaw = o.scope;
  const coreValueRaw = o.coreValue;
  if (!overviewRaw || typeof overviewRaw !== "object") return null;

  const ov = overviewRaw as Record<string, unknown>;
  const productName = readStr(ov.productName, 400);
  if (!productName) return null;

  const featuresRaw = o.coreFeatures;
  const featureItems =
    featuresRaw && typeof featuresRaw === "object" && Array.isArray((featuresRaw as Record<string, unknown>).items)
      ? ((featuresRaw as Record<string, unknown>).items as unknown[])
          .map((x) => readStr(x, 500))
          .filter(Boolean)
          .slice(0, 48)
      : [];
  const featureConf =
    featuresRaw &&
    typeof featuresRaw === "object" &&
    readStr((featuresRaw as Record<string, unknown>).confidence, 40) === "confirmed"
      ? "confirmed"
      : "needs_confirmation";

  const diffRaw = readStr(o.implementationDifficulty, 40);
  const implementationDifficulty: ProductDefinitionDifficultyV1 =
    diffRaw === "Low" || diffRaw === "Medium" || diffRaw === "High" ? diffRaw : "needs_confirmation";

  const tu = targetRaw && typeof targetRaw === "object" ? (targetRaw as Record<string, unknown>) : {};
  const sc = scopeRaw && typeof scopeRaw === "object" ? (scopeRaw as Record<string, unknown>) : {};
  const cv = coreValueRaw && typeof coreValueRaw === "object" ? (coreValueRaw as Record<string, unknown>) : {};

  const pm = parseFieldGroup(o.productModel, ["organizationModel", "pricingModel", "operatingModel"]);
  const dp = parseFieldGroup(o.dataPolicy, ["dataSensitivity", "retentionPolicy", "consentPolicy"]);
  const qp = parseFieldGroup(o.qualityPolicy, ["availabilityTarget", "performanceTarget", "recoveryPolicy"]);
  const defaults = defaultProductizationFields();

  return {
    version: PRODUCT_DEFINITION_VERSION,
    updatedAt,
    completedAt: o.completedAt === null ? null : readStr(o.completedAt, 80) || undefined,
    overview: {
      productName,
      oneLineIntro: parseField(ov.oneLineIntro),
      productPurpose: parseField(ov.productPurpose),
      problemToSolve: parseField(ov.problemToSolve),
    },
    targetUsers: {
      primaryUsers: parseField(tu.primaryUsers),
      stakeholders: parseField(tu.stakeholders),
      userRoles: parseField(tu.userRoles),
    },
    scope: {
      scopeIn: parseField(sc.scopeIn),
      scopeOut: parseField(sc.scopeOut),
      futureScope: parseField(sc.futureScope),
    },
    coreValue: {
      userValue: parseField(cv.userValue),
      differentiation: parseField(cv.differentiation),
    },
    coreWorkScenarios: parseField(o.coreWorkScenarios),
    coreFeatures: { items: featureItems, confidence: featureConf as ProductDefinitionFieldConfidence },
    externalIntegrations: parseField(o.externalIntegrations),
    successCriteria: parseField(o.successCriteria),
    implementationDifficulty,
    implementationDifficultyNotes: parseField(o.implementationDifficultyNotes),
    majorRisks: parseField(o.majorRisks),
    productModel: {
      organizationModel: pm.organizationModel ?? defaults.productModel.organizationModel,
      pricingModel: pm.pricingModel ?? defaults.productModel.pricingModel,
      operatingModel: pm.operatingModel ?? defaults.productModel.operatingModel,
    },
    dataPolicy: {
      dataSensitivity: dp.dataSensitivity ?? defaults.dataPolicy.dataSensitivity,
      retentionPolicy: dp.retentionPolicy ?? defaults.dataPolicy.retentionPolicy,
      consentPolicy: dp.consentPolicy ?? defaults.dataPolicy.consentPolicy,
    },
    qualityPolicy: {
      availabilityTarget: qp.availabilityTarget ?? defaults.qualityPolicy.availabilityTarget,
      performanceTarget: qp.performanceTarget ?? defaults.qualityPolicy.performanceTarget,
      recoveryPolicy: qp.recoveryPolicy ?? defaults.qualityPolicy.recoveryPolicy,
    },
  };
}

function fieldReady(field: ProductDefinitionTextFieldV1, key: string, missing: string[]): void {
  if (field.confidence !== "confirmed" || !field.value.trim() || field.value === PRODUCT_DEFINITION_NEEDS_CONFIRMATION) {
    missing.push(key);
  }
}

export function evaluateProductDefinitionReadiness(def: ProductDefinitionV1 | null | undefined): ProductDefinitionReadinessV1 {
  if (!def) return { ready: false, missing: ["productDefinitionV1"] };
  const missing: string[] = [];
  fieldReady(def.overview.productPurpose, "productPurpose", missing);
  fieldReady(def.overview.problemToSolve, "problemToSolve", missing);
  fieldReady(def.targetUsers.primaryUsers, "primaryUsers", missing);
  if (def.coreFeatures.items.length < 1 || def.coreFeatures.confidence !== "confirmed") {
    missing.push("coreFeatures");
  }
  fieldReady(def.scope.scopeIn, "scopeIn", missing);
  fieldReady(def.scope.scopeOut, "scopeOut", missing);
  fieldReady(def.successCriteria, "successCriteria", missing);
  if (requiresDataPolicyConfirmation(def)) {
    fieldReady(def.dataPolicy.dataSensitivity, "dataSensitivity", missing);
    fieldReady(def.dataPolicy.retentionPolicy, "retentionPolicy", missing);
    fieldReady(def.dataPolicy.consentPolicy, "consentPolicy", missing);
  }
  return { ready: missing.length === 0, missing };
}

export function buildProductDefinitionStubFromProject(input: Readonly<{
  readonly productName: string;
  readonly description?: string | null;
  readonly nowIso?: string;
}>): ProductDefinitionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const name = input.productName.trim().slice(0, 400) || "제품";
  const desc = String(input.description ?? "").trim();
  const intro = desc.slice(0, 500);
  return {
    version: PRODUCT_DEFINITION_VERSION,
    updatedAt: now,
    overview: {
      productName: name,
      oneLineIntro: fieldFromText(intro, Boolean(intro)),
      productPurpose: fieldFromText("", false),
      problemToSolve: fieldFromText("", false),
    },
    targetUsers: {
      primaryUsers: fieldFromText("", false),
      stakeholders: fieldFromText("", false),
      userRoles: fieldFromText("", false),
    },
    scope: {
      scopeIn: fieldFromText("", false),
      scopeOut: fieldFromText("", false),
      futureScope: fieldFromText("", false),
    },
    coreValue: {
      userValue: fieldFromText("", false),
      differentiation: fieldFromText("", false),
    },
    coreWorkScenarios: fieldFromText("", false),
    coreFeatures: { items: [], confidence: "needs_confirmation" },
    externalIntegrations: fieldFromText("", false),
    successCriteria: fieldFromText("", false),
    implementationDifficulty: "needs_confirmation",
    implementationDifficultyNotes: fieldFromText("", false),
    majorRisks: fieldFromText("", false),
    ...defaultProductizationFields(),
  };
}

export function buildProductDefinitionFromChatDraft(input: Readonly<{
  readonly productName: string;
  readonly description?: string | null;
  readonly draft: ProjectFromChatDraftPayloadV1;
  readonly nowIso?: string;
}>): ProductDefinitionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const d = input.draft;
  const has = (s: string) => Boolean(s.trim());
  const confirmed = (s: string) => has(s);
  const features = [...(d.featureCandidates ?? [])].map((x) => String(x).trim()).filter(Boolean).slice(0, 32);
  const scenarios = d.nextSteps?.length ? d.nextSteps.join("\n") : "";

  let difficulty: ProductDefinitionDifficultyV1 = "needs_confirmation";
  const riskHay = [...(d.assumptions ?? []), ...(d.openQuestions ?? [])].join(" ");
  if (/복잡|대규모|규제|real.?time|다중/i.test(riskHay)) difficulty = "High";
  else if (features.length >= 5 || has(d.mvpScope)) difficulty = "Medium";
  else if (has(d.problem) && has(d.targetUsers)) difficulty = "Low";

  return {
    version: PRODUCT_DEFINITION_VERSION,
    updatedAt: now,
    overview: {
      productName: input.productName.trim().slice(0, 400) || d.chosenTitle || "제품",
      oneLineIntro: fieldFromText(d.description || input.description || "", confirmed(d.description)),
      productPurpose: fieldFromText(d.valueProposition, confirmed(d.valueProposition)),
      problemToSolve: fieldFromText(d.problem, confirmed(d.problem)),
    },
    targetUsers: {
      primaryUsers: fieldFromText(d.targetUsers, confirmed(d.targetUsers)),
      stakeholders: fieldFromText("", false),
      userRoles: fieldFromText("", false),
    },
    scope: {
      scopeIn: fieldFromText(d.mvpScope, confirmed(d.mvpScope)),
      scopeOut: fieldFromText(d.explicitExclusions, confirmed(d.explicitExclusions)),
      futureScope: fieldFromText("", false),
    },
    coreValue: {
      userValue: fieldFromText(d.valueProposition, confirmed(d.valueProposition)),
      differentiation: fieldFromText("", false),
    },
    coreWorkScenarios: fieldFromText(scenarios, confirmed(scenarios)),
    coreFeatures: {
      items: features,
      confidence: features.length ? "needs_confirmation" : "needs_confirmation",
    },
    externalIntegrations: fieldFromText("", false),
    successCriteria: fieldFromText("", false),
    implementationDifficulty: difficulty,
    implementationDifficultyNotes: fieldFromText(
      d.openQuestions?.length ? `열린 질문: ${d.openQuestions.slice(0, 4).join("; ")}` : "",
      false,
    ),
    majorRisks: fieldFromText(
      d.assumptions?.length ? d.assumptions.slice(0, 6).join("\n") : "",
      false,
    ),
    ...defaultProductizationFields(),
  };
}

export function formatProductDefinitionUserSummary(def: ProductDefinitionV1): string {
  const lines: string[] = [
    "AI가 지금까지의 대화를 기준으로 제품 정의 초안을 정리했습니다.",
    "부족한 항목은 「추가 확인 필요」로 표시했습니다.",
    "수정하고 싶은 내용은 대화로 알려 주세요.",
    "준비되면 「기획 단계로 진행」이라고 입력하면 됩니다.",
    "",
    `■ 제품명: ${def.overview.productName}`,
    `■ 한 줄 소개: ${def.overview.oneLineIntro.value}`,
    `■ 제품 목적: ${def.overview.productPurpose.value}`,
    `■ 해결 문제: ${def.overview.problemToSolve.value}`,
    "",
    `■ 주요 사용자: ${def.targetUsers.primaryUsers.value}`,
    `■ 포함 범위: ${def.scope.scopeIn.value}`,
    `■ 제외 범위: ${def.scope.scopeOut.value}`,
    "",
    def.coreFeatures.items.length
      ? `■ 핵심 기능 후보:\n${def.coreFeatures.items.map((f, i) => `${i + 1}. ${f}`).join("\n")}`
      : `■ 핵심 기능: ${PRODUCT_DEFINITION_NEEDS_CONFIRMATION}`,
    "",
    `■ 성공 기준: ${def.successCriteria.value}`,
    `■ 구현 난이도: ${def.implementationDifficulty}`,
  ];
  return lines.join("\n").slice(0, 12000);
}

function clipPlanningLine(text: string): string {
  return text.trim().slice(0, 300);
}

export function formatProductDefinitionPlanningContext(def: ProductDefinitionV1 | null | undefined): readonly string[] {
  if (!def) return [];
  const lines: string[] = [
    "[Product Definition]",
    clipPlanningLine(`제품명: ${def.overview.productName}`),
    clipPlanningLine(`목적: ${def.overview.productPurpose.value}`),
    clipPlanningLine(`문제: ${def.overview.problemToSolve.value}`),
    clipPlanningLine(`주요 사용자: ${def.targetUsers.primaryUsers.value}`),
    clipPlanningLine(`범위(In): ${def.scope.scopeIn.value}`),
    clipPlanningLine(`범위(Out): ${def.scope.scopeOut.value}`),
    clipPlanningLine(`핵심 가치: ${def.coreValue.userValue.value}`),
  ];
  if (def.coreFeatures.items.length) {
    lines.push(clipPlanningLine(`핵심 기능: ${def.coreFeatures.items.slice(0, 12).join(", ")}`));
  }
  if (def.successCriteria.value && def.successCriteria.value !== PRODUCT_DEFINITION_NEEDS_CONFIRMATION) {
    lines.push(clipPlanningLine(`성공 기준: ${def.successCriteria.value}`));
  }
  lines.push(clipPlanningLine(`조직 모델: ${def.productModel.organizationModel.value}`));
  lines.push(clipPlanningLine(`운영 모델: ${def.productModel.operatingModel.value}`));
  lines.push(clipPlanningLine(`데이터 민감도: ${def.dataPolicy.dataSensitivity.value}`));
  lines.push(clipPlanningLine(`보관 정책: ${def.dataPolicy.retentionPolicy.value}`));
  lines.push(clipPlanningLine(`동의 정책: ${def.dataPolicy.consentPolicy.value}`));
  lines.push(clipPlanningLine(`가용성 목표: ${def.qualityPolicy.availabilityTarget.value}`));
  lines.push(clipPlanningLine(`성능 목표: ${def.qualityPolicy.performanceTarget.value}`));
  lines.push(clipPlanningLine(`복구 정책: ${def.qualityPolicy.recoveryPolicy.value}`));
  if (def.majorRisks.value && def.majorRisks.value !== PRODUCT_DEFINITION_NEEDS_CONFIRMATION) {
    lines.push(clipPlanningLine(`주요 리스크: ${def.majorRisks.value}`));
  }
  return lines.slice(0, 20);
}

export function isProductDefinitionCompleteIntent(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  return /기획\s*(단계)?\s*(로\s*)?(진행|시작|이동|넘어)/u.test(t) || /^PRODUCT_DEFINITION_COMPLETE$/i.test(t);
}
