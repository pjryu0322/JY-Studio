import {
  formatAiPlannerContextBlocksForTimeline,
  type AiPlannerContextBlocks,
} from "@/lib/requirements/aiPlannerContextBlocks";
import type { AiPlannerPromptMode } from "@/lib/requirements/plannerPromptMode";

export function formatMessengerPlannerTimelineHeader(input: {
  readonly mode: AiPlannerPromptMode;
  readonly roomId: string;
  readonly projectId: string | null;
  readonly layout: string;
  readonly contextBlocks: AiPlannerContextBlocks;
  readonly domainContextInjected: readonly string[];
  readonly domainContextReason?: string;
}): string {
  const ctx = [
    `mode=${input.mode}`,
    `projectId=${String(input.projectId ?? "").trim()}`,
    `roomId=${input.roomId.trim()}`,
    `layout=${input.layout}`,
    `domainContextInjected=[${input.domainContextInjected.join(", ")}]`,
    input.domainContextReason ? `domainContextReason=${input.domainContextReason}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const blocksLine = formatAiPlannerContextBlocksForTimeline(input.contextBlocks);
  return [ctx, blocksLine].filter(Boolean).join("\n");
}
