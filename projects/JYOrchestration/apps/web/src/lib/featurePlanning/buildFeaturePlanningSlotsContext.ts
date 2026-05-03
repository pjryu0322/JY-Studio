import type { IdeationDeliverableAsset } from "@/lib/requirements/ideationDeliverables";
import { parseRequirementsOrganizeContextV1 } from "@/lib/requirements/requirementsOrganizeContext";
import {
  parseRequirementsStateJson,
  type RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";

function trimSlice(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…(truncated)`;
}

function collectIdeationText(assets: IdeationDeliverableAsset[] | null | undefined, maxChars: number): string {
  if (!assets?.length) return "(없음)";
  const parts: string[] = [];
  let used = 0;
  for (const a of assets) {
    const block = `### ${a.title} (${a.type}, v${a.version})\n${a.content?.trim() ?? ""}`;
    if (used + block.length > maxChars) {
      parts.push(trimSlice(block, Math.max(0, maxChars - used)));
      break;
    }
    parts.push(block);
    used += block.length + 2;
  }
  return parts.join("\n\n") || "(없음)";
}

export function extractConfirmedActorRoleNames(flow: RequirementsServiceFlowV1 | null | undefined): string[] {
  if (!flow?.actors?.length) return [];
  const names = flow.actors.map((a) => a.name.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= 48) break;
  }
  return out;
}

function stringifyServiceFlow(flow: RequirementsServiceFlowV1 | null | undefined, max: number): string {
  if (!flow) return "(없음)";
  try {
    return trimSlice(JSON.stringify(flow, null, 0), max);
  } catch {
    return "(직렬화 실패)";
  }
}

function conversationDigest(conversationJson: unknown, maxChars: number): string {
  if (!conversationJson) return "(없음)";
  let messages: unknown[] = [];
  if (Array.isArray(conversationJson)) {
    messages = conversationJson;
  } else if (conversationJson && typeof conversationJson === "object") {
    const o = conversationJson as Record<string, unknown>;
    if (Array.isArray(o.messages)) messages = o.messages;
  }
  if (!messages.length) return "(없음)";
  const tail = messages.slice(-40);
  const lines: string[] = [];
  let used = 0;
  for (const m of tail) {
    if (!m || typeof m !== "object") continue;
    const r = m as Record<string, unknown>;
    const role = String(r.role ?? r.speakerType ?? "").trim();
    const content = typeof r.content === "string" ? r.content.trim() : "";
    if (!content) continue;
    const line = `[${role || "?"}] ${content}`;
    if (used + line.length > maxChars) {
      lines.push(trimSlice(line, Math.max(0, maxChars - used)));
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }
  return lines.length ? lines.join("\n") : "(없음)";
}

export type FeaturePlanningSlotsLlmContext = {
  projectName: string;
  projectDescription: string;
  ideationDeliverablesText: string;
  actorServiceFlowText: string;
  conversationSummaryText: string;
  /** 액터·서비스 흐름 단계에서 확정된 역할 이름(기능정리에서 재질문 금지, 참조·roleTags 용) */
  confirmedActorRoleNames: readonly string[];
  /** true면 기존 초안을 구조 관점으로 다시 만드는 요청 */
  forceRegenerate?: boolean;
};

/**
 * `requirementsStateJson` + 프로젝트 메타에서 기능 정리 LLM용 컨텍스트 문자열을 만든다.
 */
export function buildFeaturePlanningSlotsLlmContext(input: {
  projectName: string;
  projectDescription: string | null;
  requirementsStateJson: unknown;
  requirementsConversationJson: unknown;
  forceRegenerate?: boolean;
}): FeaturePlanningSlotsLlmContext {
  const state = parseRequirementsStateJson(input.requirementsStateJson);
  const organize = parseRequirementsOrganizeContextV1(state.organizeContext ?? null);
  const rolling = typeof organize?.rollingSummary === "string" ? organize.rollingSummary.trim() : "";
  const recentSnap =
    typeof organize?.recentMessagesSnapshot === "string" ? organize.recentMessagesSnapshot.trim() : "";
  const memoryFacts = organize?.memoryFacts;
  const factLines: string[] = [];
  if (memoryFacts && typeof memoryFacts === "object") {
    for (const [k, v] of Object.entries(memoryFacts)) {
      if (!v || typeof v !== "object") continue;
      const t = typeof (v as { text?: string }).text === "string" ? (v as { text: string }).text.trim() : "";
      if (t) factLines.push(`- ${k}: ${t}`);
    }
  }
  const summaryBlock = [
    rolling ? `[rollingSummary]\n${trimSlice(rolling, 6000)}` : "",
    recentSnap ? `[recentMessagesSnapshot]\n${trimSlice(recentSnap, 4000)}` : "",
    factLines.length ? `[memoryFacts]\n${factLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const convFromMessages = conversationDigest(input.requirementsConversationJson, 8000);
  const conversationSummaryText =
    summaryBlock.trim().length >= 80
      ? `${summaryBlock}\n\n[최근 대화 발췌]\n${convFromMessages}`
      : convFromMessages;

  const desc =
    [input.projectDescription?.trim() ?? "", state.originalProjectDescription?.trim() ?? ""].filter(Boolean).join(
      "\n\n",
    ) || "(없음)";

  return {
    projectName: input.projectName.trim() || "(없음)",
    projectDescription: trimSlice(desc, 6000),
    ideationDeliverablesText: collectIdeationText(state.deliverableAssets ?? null, 14000),
    actorServiceFlowText: stringifyServiceFlow(state.serviceFlowV1 ?? null, 12000),
    conversationSummaryText: trimSlice(conversationSummaryText, 16000),
    confirmedActorRoleNames: extractConfirmedActorRoleNames(state.serviceFlowV1 ?? null),
    ...(input.forceRegenerate === true ? { forceRegenerate: true } : {}),
  };
}
