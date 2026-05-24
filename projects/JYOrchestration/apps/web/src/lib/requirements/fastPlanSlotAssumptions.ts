/**
 * Extract planning fields and AI assumptions for fast prototype plan generation.
 */

import { problemInterviewSlotLabelKr, type ProblemInterviewSlot, type ProblemInterviewState } from "@/lib/requirements/problemInterview";
import type { FastPlanAssumption, FastPlanFieldSnapshot, FastPlanSlotConfidence } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  findOrchestrationSlotKeysBySuffix,
  findSlotRow,
} from "@/lib/requirements/singleChatSlotNextAction";
import { normalizeSlotStatus } from "@/lib/requirements/singleChatOrchestrationSlots";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";

const INTERVIEW_SLOT_BY_SUFFIX: Readonly<Record<string, ProblemInterviewSlot>> = {
  ".planning.servicePurpose": "serviceIdea",
  ".planning.coreUsers": "targetUser",
  ".planning.problem": "coreProblem",
  ".planning.expectedOutcome": "expectedOutcome",
  ".planning.coreValue": "expectedOutcome",
};

const FIELD_LABEL_BY_SUFFIX: Readonly<Record<string, string>> = {
  ".planning.servicePurpose": "서비스 아이디어",
  ".planning.coreUsers": "주 사용자",
  ".planning.problem": "핵심 문제",
  ".planning.expectedOutcome": "기대 효과",
  ".planning.coreValue": "기대 효과",
};

function slotConfidenceFromRow(
  orchestration: RequirementsSingleChatOrchestrationStateV1 | null | undefined,
  slotKey: string | null,
): FastPlanSlotConfidence {
  if (!slotKey) return "assumed_for_prototype";
  const row = findSlotRow(orchestration, slotKey);
  const st = normalizeSlotStatus(String(row?.status ?? "empty"));
  const v = String(row?.value ?? "").trim();
  if (st === "confirmed" && v.length >= 8) return "confirmed";
  if (st === "partial" && v.length >= 8) return "partial";
  if ((st === "candidate" || st === "partial") && v.length >= 4) return "candidate";
  return "assumed_for_prototype";
}

function interviewNote(interview: ProblemInterviewState | null | undefined, slot: ProblemInterviewSlot): string {
  const n = String(interview?.notes?.[slot] ?? "").trim();
  return n;
}

export function conversationContextSnippet(messages: readonly unknown[], maxLines = 14): string {
  const lines: string[] = [];
  for (const m of messages.slice(-24)) {
    if (!m || typeof m !== "object") continue;
    const o = m as { role?: string; body?: string };
    const body = String(o.body ?? "").trim();
    if (!body || body.length < 4) continue;
    const role = o.role === "user" ? "사용자" : "AI";
    lines.push(`${role}: ${body.slice(0, 240)}`);
    if (lines.length >= maxLines) break;
  }
  return lines.join("\n");
}

function inferAssumedValue(input: {
  readonly label: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly conversationSnippet: string;
  readonly flowHint: string;
}): string {
  const desc = input.projectDescription.trim();
  const conv = input.conversationSnippet.trim();
  const lastUser = conv
    .split("\n")
    .filter((l) => l.startsWith("사용자:"))
    .pop()
    ?.replace(/^사용자:\s*/, "")
    .trim();
  if (input.label === "서비스 아이디어") {
    return (
      desc.slice(0, 400) ||
      lastUser?.slice(0, 400) ||
      `${input.projectName.trim() || "본 서비스"}의 핵심 가치를 빠르게 검증하기 위한 웹 서비스 초안`
    );
  }
  if (input.label === "주 사용자") {
    return lastUser?.slice(0, 200) || "서비스를 직접 사용하는 실무 사용자와 의사결정자";
  }
  if (input.label === "핵심 문제") {
    return (
      desc.slice(0, 300) ||
      lastUser?.slice(0, 300) ||
      "반복 업무·정보 단절로 인한 기획·실행 지연"
    );
  }
  if (input.label === "기대 효과") {
    return input.flowHint || "핵심 흐름을 빠르게 시각화하고 프로토타입으로 검증";
  }
  return `${input.label}에 대한 초기 후보(빠른 프로토타입용)`;
}

function resolveField(input: {
  readonly suffix: string;
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly interview: ProblemInterviewState | null;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly conversationSnippet: string;
  readonly flowHint: string;
}): { readonly snapshot: FastPlanFieldSnapshot; readonly assumption: FastPlanAssumption | null } {
  const label = FIELD_LABEL_BY_SUFFIX[input.suffix] ?? input.suffix;
  const slotKey = findOrchestrationSlotKeysBySuffix(input.definitions, input.suffix)[0] ?? null;
  let confidence = slotConfidenceFromRow(input.orchestration, slotKey);
  let value = slotKey ? String(findSlotRow(input.orchestration, slotKey)?.value ?? "").trim() : "";
  const interviewSlot = INTERVIEW_SLOT_BY_SUFFIX[input.suffix];
  if (!value && interviewSlot) {
    const note = interviewNote(input.interview, interviewSlot);
    if (note.length >= 4) {
      value = note;
      if (confidence === "assumed_for_prototype") confidence = "candidate";
    }
  }
  let assumption: FastPlanAssumption | null = null;
  if (!value || confidence === "assumed_for_prototype") {
    const assumed = inferAssumedValue({
      label,
      projectName: input.projectName,
      projectDescription: input.projectDescription,
      conversationSnippet: input.conversationSnippet,
      flowHint: input.flowHint,
    });
    if (!value) value = assumed;
    assumption = {
      slotKey: slotKey ?? input.suffix,
      label,
      value: assumed,
      confidence: "assumed_for_prototype",
      reason: "필수 슬롯이 확정되지 않아 빠른 프로토타입용 AI 가정으로 보완",
    };
    confidence = value === assumed ? "assumed_for_prototype" : confidence;
  } else if (confidence === "candidate") {
    assumption = {
      slotKey: slotKey ?? input.suffix,
      label,
      value,
      confidence: "candidate",
      reason: "대화·후보 슬롯에서 추출(미확정)",
    };
  }
  return {
    snapshot: { label, value, confidence, slotKey },
    assumption,
  };
}

export function collectFastPlanFieldSnapshots(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: readonly SingleChatOrchestrationSlotDefinition[];
  readonly interview: ProblemInterviewState | null;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly conversationMessages: readonly unknown[];
  readonly serviceFlow: RequirementsServiceFlowV1 | null;
  readonly featurePlanning: FeaturePlanningSlotsArtifactV1 | null;
}): Readonly<{
  readonly servicePurpose: FastPlanFieldSnapshot;
  readonly coreUsers: FastPlanFieldSnapshot;
  readonly coreProblem: FastPlanFieldSnapshot;
  readonly expectedOutcome: FastPlanFieldSnapshot;
  readonly assumptions: readonly FastPlanAssumption[];
  readonly missingAtGeneration: readonly string[];
  readonly featureCandidates: readonly string[];
  readonly flowSteps: readonly string[];
  readonly screenCandidates: readonly string[];
  readonly summary: string;
}> {
  const flowSteps = [...(input.serviceFlow?.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => String(s.title ?? "").trim())
    .filter(Boolean);
  const flowHint = flowSteps.length ? flowSteps.slice(0, 5).join(" → ") : "";
  const snippet = conversationContextSnippet(input.conversationMessages);

  const purpose = resolveField({
    suffix: ".planning.servicePurpose",
    orchestration: input.orchestration,
    definitions: input.definitions,
    interview: input.interview,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationSnippet: snippet,
    flowHint,
  });
  const users = resolveField({
    suffix: ".planning.coreUsers",
    orchestration: input.orchestration,
    definitions: input.definitions,
    interview: input.interview,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationSnippet: snippet,
    flowHint,
  });
  const problem = resolveField({
    suffix: ".planning.problem",
    orchestration: input.orchestration,
    definitions: input.definitions,
    interview: input.interview,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationSnippet: snippet,
    flowHint,
  });
  const outcomeSuffix =
    findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.expectedOutcome")[0] ?
      ".planning.expectedOutcome"
    : ".planning.coreValue";
  const outcome = resolveField({
    suffix: outcomeSuffix,
    orchestration: input.orchestration,
    definitions: input.definitions,
    interview: input.interview,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationSnippet: snippet,
    flowHint,
  });

  const assumptions = [purpose.assumption, users.assumption, problem.assumption, outcome.assumption].filter(
    (a): a is FastPlanAssumption => Boolean(a),
  );
  const missingAtGeneration = assumptions
    .filter((a) => a.confidence === "assumed_for_prototype")
    .map((a) => a.label);

  const featureCandidates: string[] = [];
  const notesFeatures = interviewNote(input.interview, "mustHaveFeatures");
  if (notesFeatures) featureCandidates.push(...notesFeatures.split(/[,·\n]/).map((x) => x.trim()).filter(Boolean));
  for (const slot of input.featurePlanning?.slots ?? []) {
    const name = String(slot.slotName ?? slot.slotKey ?? "").trim();
    if (name) featureCandidates.push(name);
    for (const item of slot.items ?? []) {
      const n = String(item.name ?? "").trim();
      if (n) featureCandidates.push(n);
    }
  }
  const archKey = findOrchestrationSlotKeysBySuffix(input.definitions, ".design.coreFeatures")[0];
  if (archKey) {
    const v = String(findSlotRow(input.orchestration, archKey)?.value ?? "").trim();
    if (v) featureCandidates.push(...v.split(/[,·\n]/).map((x) => x.trim()).filter(Boolean));
  }

  const screenCandidates: string[] = [];
  const screenKey = findOrchestrationSlotKeysBySuffix(input.definitions, ".design.requiredScreens")[0];
  if (screenKey) {
    const v = String(findSlotRow(input.orchestration, screenKey)?.value ?? "").trim();
    if (v) screenCandidates.push(...v.split(/[,·\n]/).map((x) => x.trim()).filter(Boolean));
  }

  const summary =
    purpose.snapshot.value.slice(0, 120) ||
    input.projectName.trim() ||
    "빠른 프로토타입 기획 초안";

  return {
    servicePurpose: purpose.snapshot,
    coreUsers: users.snapshot,
    coreProblem: problem.snapshot,
    expectedOutcome: outcome.snapshot,
    assumptions,
    missingAtGeneration,
    featureCandidates: [...new Set(featureCandidates)].slice(0, 12),
    flowSteps: flowSteps.slice(0, 10),
    screenCandidates: [...new Set(screenCandidates)].slice(0, 10),
    summary,
  };
}

export function interviewLabelsForMissing(missing: readonly string[]): readonly string[] {
  return missing.map((label) => {
    const entry = Object.entries(FIELD_LABEL_BY_SUFFIX).find(([, l]) => l === label);
    if (!entry) return label;
    const slot = INTERVIEW_SLOT_BY_SUFFIX[entry[0]];
    return slot ? problemInterviewSlotLabelKr(slot) : label;
  });
}
