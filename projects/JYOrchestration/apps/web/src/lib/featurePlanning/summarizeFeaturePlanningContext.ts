import type { FeaturePlanningMemoryV1 } from "@/lib/featurePlanning/featurePlanningMemory";
import { compactMemorySnapshot, defaultFeaturePlanningMemory } from "@/lib/featurePlanning/featurePlanningMemory";
import { buildOrderedSlotsVisible } from "@/lib/featurePlanning/featurePlanningLegacyRoleSlots";
import type { FeaturePlanningSlotsArtifactV1 } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { buildOrderedSlots } from "@/lib/featurePlanning/featurePlanningSlotsArtifact";
import { currentTaskInstructionForTopic } from "@/lib/featurePlanning/featurePlanningState";
import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
import { planningTopicLabelKo } from "@/lib/featurePlanning/featurePlanningTopic";
import type { FeaturePlanningWorkspaceChatMessageV1 } from "@/lib/featurePlanning/featurePlanningWorkspaceChat";
import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import { parseRequirementsOrganizeContextV1 } from "@/lib/requirements/requirementsOrganizeContext";
import { parseRequirementsStateJson, type RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";

export type FeaturePlanningCompactBlocksV2 = {
  readonly projectSummary: string;
  readonly actorSummary: string;
  readonly flowSummary: string;
  readonly slotSummary: string;
  readonly recentConversation: string;
  readonly memoryStateJson: string;
  readonly currentTaskInstruction: string;
  readonly userLatestInput: string;
};

export type FeaturePlanningCompactBuildMeta = {
  readonly compressedContextChars: number;
  readonly recentConversationChars: number;
};

const LIM = {
  project: 300,
  actor: 300,
  flow: 300,
  slot: 500,
  recentChat: 800,
  userInput: 400,
} as const;

function clamp(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function firstLine(s: string): string {
  const t = s.trim();
  const i = t.indexOf("\n");
  return (i >= 0 ? t.slice(0, i) : t).trim();
}

function summarizeIdeationCompact(assets: IdeationDeliverableAsset[] | null | undefined, max: number): string {
  if (!assets?.length) return "(아이디어 산출물 없음)";
  const parts: string[] = [];
  let used = 0;
  for (const a of assets.slice(0, 3)) {
    const title = (a.title ?? "").trim() || "(제목 없음)";
    const body = (a.content ?? "").trim().replace(/\s+/g, " ");
    const line = `${title}: ${clamp(body, 140)}`;
    if (used + line.length > max) {
      parts.push(clamp(line, Math.max(40, max - used)));
      break;
    }
    parts.push(line);
    used += line.length + 2;
  }
  return clamp(parts.join(" | "), max);
}

function summarizeActors(flow: RequirementsServiceFlowV1 | null | undefined, max: number): string {
  if (!flow?.actors?.length) return "(액터 정의 없음)";
  const lines: string[] = ["주요 역할:"];
  for (const a of flow.actors.slice(0, 8)) {
    const desc = clamp((a.description ?? "").trim().replace(/\s+/g, " "), 80);
    const kind = a.kind === "system" ? "시스템" : "사용자";
    lines.push(`- ${a.name.trim()}(${kind})${desc ? `: ${desc}` : ""}`);
  }
  return clamp(lines.join("\n"), max);
}

function summarizeFlow(flow: RequirementsServiceFlowV1 | null | undefined, max: number): string {
  if (!flow?.steps?.length) return "(서비스 흐름 단계 없음)";
  const ordered = [...flow.steps].sort((a, b) => a.order - b.order);
  const titles = ordered
    .filter((s) => s.approved !== false)
    .map((s) => s.title.trim())
    .filter(Boolean);
  const chain = titles.length ? titles.join(" → ") : ordered.map((s) => s.title.trim()).filter(Boolean).join(" → ");
  return clamp(`승인된 흐름:\n${chain || "(단계 제목 없음)"}`, max);
}

function summarizeSlots(artifact: FeaturePlanningSlotsArtifactV1, max: number): string {
  const visible = buildOrderedSlotsVisible(artifact);
  const ordered = visible.length ? visible : buildOrderedSlots(artifact);
  if (!ordered.length) return "(슬롯 없음)";
  const topic = artifact.planningTopic ?? "FEATURES";
  const pr = artifact.prototypeReadiness?.status ?? "NEEDS_REVIEW";
  const lines: string[] = [
    "현재 슬롯:",
    ...ordered.slice(0, 10).map((s) => {
      const names = s.items.map((it) => it.name.trim()).filter(Boolean);
      const head = names.slice(0, 4).join(", ");
      const more = names.length > 4 ? ` 외${names.length - 4}` : "";
      return `${s.slotName}(${names.length})${head ? `: ${head}${more}` : ""}`;
    }),
    "",
    `planningTopic: ${topic} (${planningTopicLabelKo(topic)})`,
    `prototypeReadiness: ${pr}`,
  ];
  return clamp(lines.join("\n"), max);
}

/** 최근 사용자/AI 턴 — user 메시지 직전까지(현재 입력은 별도 블록). */
export function buildRecentFpConversationBlock(
  messages: readonly FeaturePlanningWorkspaceChatMessageV1[],
  options?: { readonly excludeLastUser?: boolean; readonly maxChars?: number; readonly maxTurns?: number }
): string {
  const maxChars = options?.maxChars ?? LIM.recentChat;
  const maxTurns = options?.maxTurns ?? 5;
  let rows = [...messages];
  if (options?.excludeLastUser && rows.length && rows[rows.length - 1]?.role === "user") {
    rows = rows.slice(0, -1);
  }
  const tail = rows.slice(-maxTurns * 2);
  const lines: string[] = ["최근 대화:"];
  let used = 12;
  for (const m of tail) {
    const role = m.role === "user" ? "사용자" : "AI";
    const text = clamp(m.text.replace(/\s+/g, " "), 220);
    const line = `${role}: ${text}`;
    if (used + line.length > maxChars) {
      lines.push(clamp(line, Math.max(20, maxChars - used)));
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return clamp(lines.join("\n"), maxChars);
}

export function buildProjectSummaryBlock(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
}): string {
  const state = parseRequirementsStateJson(input.requirementsStateJson);
  const organize = parseRequirementsOrganizeContextV1(state.organizeContext ?? null);
  const rolling = typeof organize?.rollingSummary === "string" ? organize.rollingSummary.trim() : "";
  const desc = [input.projectDescription.trim(), state.originalProjectDescription?.trim() ?? ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
  const ideationHint = summarizeIdeationCompact(state.deliverableAssets ?? null, 160);
  const problem = firstLine(rolling) || firstLine(desc) || "(맥락 없음)";
  const goal = ideationHint !== "(아이디어 산출물 없음)" ? ideationHint : clamp(desc, 200);
  const body = [`프로젝트: ${input.projectName.trim() || "(이름 없음)"}`, "", "문제:", problem, "", "목표:", goal].join("\n");
  return clamp(body, LIM.project);
}

export function buildActorSummaryFromState(requirementsStateJson: unknown): string {
  const state = parseRequirementsStateJson(requirementsStateJson);
  return summarizeActors(state.serviceFlowV1 ?? null, LIM.actor);
}

export function buildFlowSummaryFromState(requirementsStateJson: unknown): string {
  const state = parseRequirementsStateJson(requirementsStateJson);
  return summarizeFlow(state.serviceFlowV1 ?? null, LIM.flow);
}

export function buildFeaturePlanningCompactBlocks(input: {
  readonly projectName: string;
  readonly projectDescription: string;
  readonly requirementsStateJson: unknown;
  /** 초기 생성 전에는 null — 슬롯 요약만 "(슬롯 없음)" 처리 */
  readonly artifact: FeaturePlanningSlotsArtifactV1 | null | undefined;
  readonly workspaceMessages: readonly FeaturePlanningWorkspaceChatMessageV1[];
  readonly userMessage: string;
  readonly currentTopic: FeaturePlanningTopicV1;
  readonly memory: FeaturePlanningMemoryV1 | undefined;
  /** 직전 AI 말풍선 — 번호 선택 해석용(요약 블록에 포함, 길이 제한) */
  readonly lastAssistantSnippet?: string;
}): FeaturePlanningCompactBlocksV2 & FeaturePlanningCompactBuildMeta {
  const projectSummary = buildProjectSummaryBlock({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    requirementsStateJson: input.requirementsStateJson,
  });
  const actorSummary = buildActorSummaryFromState(input.requirementsStateJson);
  const flowSummary = buildFlowSummaryFromState(input.requirementsStateJson);
  const slotSummary =
    input.artifact?.slots?.length ? summarizeSlots(input.artifact, LIM.slot) : "(슬롯 없음 — 초기 생성)";
  const lastAi = (input.lastAssistantSnippet ?? "").trim();
  const recentCore = buildRecentFpConversationBlock(input.workspaceMessages, {
    excludeLastUser: true,
    maxChars: Math.max(120, LIM.recentChat - (lastAi ? Math.min(320, lastAi.length) : 0)),
    maxTurns: 5,
  });
  const recentConversation = lastAi
    ? clamp(`${recentCore}\n\n[직전 AI 응답 발췌 — 숫자 선택 해석용]\n${clamp(lastAi, 320)}`, LIM.recentChat)
    : recentCore;
  const mem = input.memory ?? defaultFeaturePlanningMemory();
  let memoryStateJson: string;
  try {
    memoryStateJson = clamp(JSON.stringify(mem), 420);
  } catch {
    memoryStateJson = "{}";
  }
  const currentTaskInstruction = currentTaskInstructionForTopic(input.currentTopic);
  const userLatestInput = clamp(input.userMessage.trim(), LIM.userInput);
  const blocks: FeaturePlanningCompactBlocksV2 = {
    projectSummary,
    actorSummary,
    flowSummary,
    slotSummary,
    recentConversation,
    memoryStateJson,
    currentTaskInstruction,
    userLatestInput,
  };
  const compressedContextChars =
    projectSummary.length +
    actorSummary.length +
    flowSummary.length +
    slotSummary.length +
    memoryStateJson.length +
    currentTaskInstruction.length;
  return { ...blocks, compressedContextChars, recentConversationChars: recentConversation.length };
}

export function memorySnapshotForLog(mem: FeaturePlanningMemoryV1 | undefined): string {
  return compactMemorySnapshot(mem, 360);
}
