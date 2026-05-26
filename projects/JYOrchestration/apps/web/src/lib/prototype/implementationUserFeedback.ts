import {
  type CommonDetailFeature,
  type ImplementationSeedV1,
} from "@/lib/requirements/implementationSeed";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import {
  parseRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";

export const IMPLEMENTATION_USER_FEEDBACK_PATCH_VERSION = "implementation_user_feedback_patch_v1" as const;

export const IMPLEMENTATION_USER_FEEDBACK_APPLIED_INTERNAL_TYPE =
  "IMPLEMENTATION_USER_FEEDBACK_APPLIED_V1" as const;

export type ImplementationUserFeedbackKind =
  | "feature_requirement"
  | "screen_requirement"
  | "actor_permission"
  | "file_upload_policy"
  | "security_policy"
  | "validation_rule"
  | "data_policy"
  | "mock_data_policy"
  | "db_requirement"
  | "review_criteria"
  | "common_detail_feature"
  | "unknown";

export type ImplementationExtractedRule = Readonly<{
  readonly label: string;
  readonly value: string;
  readonly normalizedValue?: string;
  readonly confidence: "high" | "medium" | "low";
}>;

export type ImplementationFeedbackTargetArea =
  | "implementation_seed"
  | "implementation_work_plan_draft"
  | "implementation_slots"
  | "review_criteria"
  | "security_criteria"
  | "common_detail_features"
  | "data_policy";

export type ImplementationUserFeedbackPatchV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_USER_FEEDBACK_PATCH_VERSION;
  readonly id: string;
  readonly createdAt: string;
  readonly sourceMessageId: string;
  readonly rawText: string;
  readonly kinds: readonly ImplementationUserFeedbackKind[];
  readonly extractedRules: readonly ImplementationExtractedRule[];
  readonly targetAreas: readonly ImplementationFeedbackTargetArea[];
  readonly status: "candidate" | "confirmed";
}>;

const KIND_KEYWORDS: Readonly<Record<ImplementationUserFeedbackKind, readonly RegExp[]>> = {
  file_upload_policy: [/파일|첨부|업로드|mp3|wav|용량|mb|m\b|확장자/i],
  security_policy: [/삭제|보관|임시\s*파일|로그|개인정보|보안|암호/i],
  data_policy: [/삭제|보관|임시|데이터|저장|조회|이력/i],
  validation_rule: [/검증|제한|실패|오류|유효|허용/i],
  actor_permission: [/권한|관리자|사용자|검수|액터|역할/i],
  screen_requirement: [/화면|버튼|ui|입력\s*창/i],
  feature_requirement: [/기능|프로세스|흐름|예외/i],
  mock_data_policy: [/mock|샘플|더미|테스트\s*데이터/i],
  db_requirement: [/db|데이터베이스|스키마|테이블/i],
  review_criteria: [/검수|리뷰|품질\s*기준/i],
  common_detail_feature: [/공통|로딩|빈\s*결과|재시도/i],
  unknown: [],
};

const EXPLICIT_EXECUTION_REQUEST =
  /^\s*(작업\s*계획\s*생성|작업계획생성|작업\s*계획\s*수립|작업계획수립|실행\s*계획\s*수립|실행계획\s*수립|실행계획수립|workunit|work\s*unit|구현\s*실행|code\s*agent\s*wip|코드\s*에이전트\s*wip|wip\s*작업\s*요청)\s*$/i;

export function isExplicitImplementationExecutionRequest(text: string): boolean {
  return EXPLICIT_EXECUTION_REQUEST.test(String(text ?? "").trim());
}

export function classifyImplementationUserFeedback(text: string): readonly ImplementationUserFeedbackKind[] {
  const t = String(text ?? "").trim();
  if (!t) return ["unknown"];
  const kinds = new Set<ImplementationUserFeedbackKind>();
  for (const [kind, patterns] of Object.entries(KIND_KEYWORDS) as Array<
    [ImplementationUserFeedbackKind, readonly RegExp[]]
  >) {
    if (kind === "unknown") continue;
    if (patterns.some((p) => p.test(t))) kinds.add(kind);
  }
  if (!kinds.size) kinds.add("unknown");
  return [...kinds];
}

function normalizeFileSize(raw: string): string | undefined {
  const m = raw.match(/(\d+)\s*(m|mb|메가|mega)?/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `${n}MB`;
}

function extractRulesFromText(text: string): ImplementationExtractedRule[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rules: ImplementationExtractedRule[] = [];

  for (const line of lines.length ? lines : [text]) {
    const allowed =
      line.match(/허용\s*(?:파일|형식|확장자)?\s*[:：]?\s*(.+)/i) ??
      line.match(/(?:mp3|wav)[^\n]*/i);
    if (/허용|mp3|wav/i.test(line)) {
      const formats = [...line.matchAll(/\b(mp3|wav|m4a|pdf|png|jpe?g)\b/gi)].map((m) => m[1]!.toUpperCase());
      if (formats.length) {
        rules.push({
          label: "허용 파일 형식",
          value: formats.join(", "),
          normalizedValue: formats.map((f) => f.toLowerCase()).join(","),
          confidence: "high",
        });
        continue;
      }
      if (allowed?.[1]) {
        rules.push({
          label: "허용 파일 형식",
          value: allowed[1].trim(),
          confidence: "medium",
        });
        continue;
      }
    }

    if (/임시\s*파일/i.test(line) && /삭제|제거|바로/i.test(line)) {
      rules.push({
        label: "임시파일 처리",
        value: "처리 후 즉시 삭제",
        confidence: "high",
      });
      continue;
    }

    if (/첨부|업로드|용량|파일\s*크기/i.test(line) && /\d+\s*m/i.test(line)) {
      const size = normalizeFileSize(line) ?? line.match(/(\d+\s*m(?:b)?)/i)?.[1];
      if (size) {
        rules.push({
          label: "첨부파일 용량 제한",
          value: size.includes("MB") ? `${size}` : `${size} 이내`,
          normalizedValue: normalizeFileSize(line) ?? size,
          confidence: "high",
        });
        continue;
      }
    }

    if (/권한|관리자만|검수자만/i.test(line)) {
      rules.push({
        label: "액터 권한/기능",
        value: line,
        confidence: "medium",
      });
      continue;
    }

    if (/화면|버튼/i.test(line)) {
      rules.push({
        label: "화면/UX 요구",
        value: line,
        confidence: "medium",
      });
    }
  }

  const seen = new Set<string>();
  return rules.filter((r) => {
    const key = `${r.label}:${r.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveTargetAreas(kinds: readonly ImplementationUserFeedbackKind[]): ImplementationFeedbackTargetArea[] {
  const areas = new Set<ImplementationFeedbackTargetArea>();
  areas.add("implementation_seed");
  areas.add("implementation_work_plan_draft");
  if (kinds.some((k) => k === "review_criteria" || k === "validation_rule" || k === "feature_requirement")) {
    areas.add("review_criteria");
  }
  if (kinds.some((k) => k === "security_policy" || k === "file_upload_policy" || k === "data_policy")) {
    areas.add("security_criteria");
  }
  if (kinds.some((k) => k === "common_detail_feature" || k === "file_upload_policy" || k === "validation_rule")) {
    areas.add("common_detail_features");
  }
  if (kinds.some((k) => k === "data_policy" || k === "mock_data_policy" || k === "db_requirement")) {
    areas.add("data_policy");
  }
  return [...areas];
}

export function buildImplementationUserFeedbackPatch(input: {
  readonly text: string;
  readonly sourceMessageId: string;
  readonly nowIso?: string;
}): ImplementationUserFeedbackPatchV1 {
  const rawText = String(input.text ?? "").trim();
  const now = input.nowIso ?? new Date().toISOString();
  const kinds = classifyImplementationUserFeedback(rawText);
  const extractedRules = extractRulesFromText(rawText);
  return {
    version: IMPLEMENTATION_USER_FEEDBACK_PATCH_VERSION,
    id: `impl-fb-${now.replace(/[:.]/g, "")}-${input.sourceMessageId.slice(-8)}`,
    createdAt: now,
    sourceMessageId: input.sourceMessageId,
    rawText,
    kinds,
    extractedRules,
    targetAreas: resolveTargetAreas(kinds),
    status: "candidate",
  };
}

export function isImplementationUserFeedbackRelevant(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || isExplicitImplementationExecutionRequest(trimmed)) return false;
  const kinds = classifyImplementationUserFeedback(trimmed);
  const rules = extractRulesFromText(trimmed);
  if (rules.length > 0) return true;
  return kinds.some((k) => k !== "unknown");
}

export function buildImplementationUserFeedbackPatchIfRelevant(input: {
  readonly text: string;
  readonly sourceMessageId: string;
  readonly nowIso?: string;
}): ImplementationUserFeedbackPatchV1 | null {
  if (!isImplementationUserFeedbackRelevant(input.text)) return null;
  return buildImplementationUserFeedbackPatch(input);
}

export function parseImplementationUserFeedbackPatchV1(raw: unknown): ImplementationUserFeedbackPatchV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_USER_FEEDBACK_PATCH_VERSION) return null;
  const id = String(o.id ?? "").trim();
  const createdAt = String(o.createdAt ?? "").trim();
  const sourceMessageId = String(o.sourceMessageId ?? "").trim();
  if (!id || !createdAt || !sourceMessageId) return null;
  const statusRaw = String(o.status ?? "candidate").trim();
  const status = statusRaw === "confirmed" ? "confirmed" : "candidate";
  const parseRules = (key: string): ImplementationExtractedRule[] =>
    (Array.isArray(o[key]) ? o[key] : [])
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const r = item as Record<string, unknown>;
        const label = String(r.label ?? "").trim();
        const value = String(r.value ?? "").trim();
        if (!label || !value) return null;
        const confRaw = String(r.confidence ?? "medium").trim();
        const confidence =
          confRaw === "high" || confRaw === "low" ? confRaw : ("medium" as const);
        return {
          label,
          value,
          ...(typeof r.normalizedValue === "string" && r.normalizedValue.trim()
            ? { normalizedValue: r.normalizedValue.trim() }
            : {}),
          confidence,
        };
      })
      .filter(Boolean) as ImplementationExtractedRule[];

  return {
    version: IMPLEMENTATION_USER_FEEDBACK_PATCH_VERSION,
    id,
    createdAt,
    sourceMessageId,
    rawText: String(o.rawText ?? "").trim(),
    kinds: (Array.isArray(o.kinds) ? o.kinds : []).map(String).filter(Boolean) as ImplementationUserFeedbackKind[],
    extractedRules: parseRules("extractedRules"),
    targetAreas: (Array.isArray(o.targetAreas) ? o.targetAreas : []).map(
      String,
    ) as ImplementationFeedbackTargetArea[],
    status,
  };
}

export function parseImplementationUserFeedbackPatchesV1(
  raw: unknown,
): readonly ImplementationUserFeedbackPatchV1[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return null;
  return raw.map(parseImplementationUserFeedbackPatchV1).filter(Boolean) as ImplementationUserFeedbackPatchV1[];
}

function ruleToFeature(rule: ImplementationExtractedRule): CommonDetailFeature {
  return {
    name: rule.label,
    appliesTo: ["전체"],
    description: rule.value,
    required: rule.confidence === "high",
  };
}

export function applyUserFeedbackPatchToImplementationSeed(
  seed: ImplementationSeedV1 | null | undefined,
  patch: ImplementationUserFeedbackPatchV1,
): ImplementationSeedV1 | null {
  if (!seed) return null;
  const now = new Date().toISOString();
  const assumptions = [
    ...seed.assumptions,
    ...patch.extractedRules.map((r) => `${r.label}: ${r.value}`),
  ];
  const commonDetailFeatures = [
    ...seed.commonDetailFeatures,
    ...patch.extractedRules.map(ruleToFeature),
  ];
  const mockNotes = [
    ...seed.dataModelSeed.mockDataNotes,
    ...patch.extractedRules
      .filter((r) => r.label.includes("파일") || r.label.includes("용량") || r.label.includes("임시"))
      .map((r) => r.value),
  ];
  const lifecycleStatus =
    seed.lifecycleStatus === "confirmed" && patch.status === "candidate" ? "partial" : seed.lifecycleStatus;

  return {
    ...seed,
    updatedAt: now,
    lifecycleStatus,
    assumptions: [...new Set(assumptions)].slice(0, 24),
    commonDetailFeatures: [...new Map(commonDetailFeatures.map((f) => [f.name, f])).values()].slice(0, 32),
    dataModelSeed: {
      ...seed.dataModelSeed,
      mockDataNotes: [...new Set(mockNotes)].slice(0, 16),
    },
  };
}

export function applyUserFeedbackPatchToImplementationWorkPlanDraft(
  draft: ImplementationWorkPlanDraftV1 | null | undefined,
  patch: ImplementationUserFeedbackPatchV1,
): ImplementationWorkPlanDraftV1 | null {
  if (!draft) return null;
  const now = new Date().toISOString();
  const lines = patch.extractedRules.map((r) => `${r.label}: ${r.value}`);
  return {
    ...draft,
    updatedAt: now,
    status: draft.status === "confirmed" ? "revised" : draft.status,
    assumptions: [...new Set([...draft.assumptions, ...lines])].slice(0, 24),
    implementationApproach: [
      ...draft.implementationApproach,
      "사용자 추가 구현 기준을 작업안·Code Agent 지시에 반영",
    ].slice(0, 12),
    commonDetailFeatures: [
      ...(draft.commonDetailFeatures ?? []),
      ...patch.extractedRules.map(ruleToFeature),
    ],
  };
}

export function mergeUserFeedbackPatchesIntoWorkPlanDraft(
  draft: ImplementationWorkPlanDraftV1,
  patches: readonly ImplementationUserFeedbackPatchV1[],
): ImplementationWorkPlanDraftV1 {
  return patches.reduce(
    (acc, patch) => applyUserFeedbackPatchToImplementationWorkPlanDraft(acc, patch) ?? acc,
    draft,
  );
}

export function appendImplementationUserFeedbackPatches(
  existing: readonly ImplementationUserFeedbackPatchV1[] | null | undefined,
  patch: ImplementationUserFeedbackPatchV1,
): readonly ImplementationUserFeedbackPatchV1[] {
  return [...(existing ?? []), patch].slice(-80);
}

const TARGET_AREA_LABELS: Readonly<Record<ImplementationFeedbackTargetArea, string>> = {
  implementation_seed: "구현 준비정보(Implementation Seed)",
  implementation_work_plan_draft: "구현 작업안 초안",
  implementation_slots: "구현 슬롯",
  review_criteria: "업로드 기능 검증 기준",
  security_criteria: "파일 보안 기준",
  common_detail_features: "공통 상세기능",
  data_policy: "데이터/Mock 처리 기준",
};

export function buildImplementationUserFeedbackAppliedMessage(input: {
  readonly patch: ImplementationUserFeedbackPatchV1;
  readonly envOk: boolean;
}): RequirementsMessage {
  const ruleLines = input.patch.extractedRules.length
    ? input.patch.extractedRules.map((r) => `- ${r.label}: ${r.value}`)
    : [`- ${input.patch.rawText.split(/\n+/)[0] ?? input.patch.rawText}`];

  const areaLines = input.patch.targetAreas.map((a) => `- ${TARGET_AREA_LABELS[a] ?? a}`);

  const lines = [
    "요청하신 구현 기준을 반영했습니다.",
    "",
    "반영 항목:",
    ...ruleLines,
    "",
    "반영 위치:",
    ...areaLines,
    "",
    input.envOk
      ? "이 내용은 다음 Code Agent WIP 작업 지시에 포함됩니다."
      : "단, Code Agent WIP 작업 요청은 실행 환경 점검이 완료된 뒤 진행할 수 있습니다.",
  ];

  return newRequirementsMessage({
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: "AI개발자",
    messageType: "NOTICE",
    content: lines.join("\n"),
    createdAt: input.patch.createdAt,
    meta: {
      serviceDesignStage: "implementation",
      internalType: IMPLEMENTATION_USER_FEEDBACK_APPLIED_INTERNAL_TYPE,
      interviewAllowCustomInput: true,
    },
  });
}

export function buildImplementationUserFeedbackAppliedTimelineEntry(input: {
  readonly patch: ImplementationUserFeedbackPatchV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const now = input.nowIso ?? input.patch.createdAt;
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_user_feedback_applied",
    source: "system",
    responseText: [
      "type=implementation_user_feedback_applied",
      "mode=implementation",
      `kinds=${input.patch.kinds.join(",")}`,
      `extractedRuleCount=${input.patch.extractedRules.length}`,
      `targetAreas=${input.patch.targetAreas.join(",")}`,
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

/** Code Agent work item prompt appendix — patches from implementation phase chat */
export function formatImplementationUserFeedbackForCodeAgentPrompt(
  patches: readonly ImplementationUserFeedbackPatchV1[] | null | undefined,
): string {
  const list = patches ?? [];
  if (!list.length) return "";
  const lines = list.flatMap((p) => p.extractedRules.map((r) => `- ${r.label}: ${r.value}`));
  if (!lines.length) return "";
  return ["## 사용자 추가 구현 기준", ...lines.slice(0, 24)].join("\n");
}

export function buildImplementationUserFeedbackOrchestrationPatch(input: {
  readonly requirementsStateJson: unknown;
  readonly patch: ImplementationUserFeedbackPatchV1;
  readonly nowIso?: string;
}): Pick<
  RequirementsStateJson,
  | "implementationUserFeedbackPatchesV1"
  | "implementationSeedV1"
  | "implementationWorkPlanDraftV1"
  | "promptTimeline"
> {
  const base = parseRequirementsStateJson(input.requirementsStateJson);
  const patches = appendImplementationUserFeedbackPatches(
    base.implementationUserFeedbackPatchesV1,
    input.patch,
  );
  const seed = applyUserFeedbackPatchToImplementationSeed(base.implementationSeedV1, input.patch);
  const draft = applyUserFeedbackPatchToImplementationWorkPlanDraft(
    base.implementationWorkPlanDraftV1,
    input.patch,
  );
  const timeline = appendPromptTimeline(
    base.promptTimeline,
    buildImplementationUserFeedbackAppliedTimelineEntry({ patch: input.patch, nowIso: input.nowIso }),
  );

  return {
    implementationUserFeedbackPatchesV1: patches,
    ...(seed !== null && seed !== undefined ? { implementationSeedV1: seed } : {}),
    ...(draft !== null && draft !== undefined ? { implementationWorkPlanDraftV1: draft } : {}),
    promptTimeline: timeline,
  };
}
