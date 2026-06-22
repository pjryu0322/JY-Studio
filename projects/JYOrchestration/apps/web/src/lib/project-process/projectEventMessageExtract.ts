import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { coerceRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { PROJECT_PROCESS_STAGES } from "@/lib/project-process/projectEventTypes";

export type ExtractedRequirementsMessageForEventStore = Readonly<{
  readonly message: RequirementsMessage;
  readonly stage: string;
}>;

function readConversationMessages(conversationJson: unknown): readonly unknown[] {
  if (!conversationJson || typeof conversationJson !== "object") return [];
  const messages = (conversationJson as Record<string, unknown>).messages;
  return Array.isArray(messages) ? messages : [];
}

function collectMessageIds(conversationJson: unknown | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const raw of readConversationMessages(conversationJson)) {
    if (!raw || typeof raw !== "object") continue;
    const id = String((raw as Record<string, unknown>).id ?? "").trim();
    if (id) ids.add(id);
  }
  return ids;
}

export function mapServiceDesignStageToProcessStage(
  serviceDesignStage: string | null | undefined,
  fallbackStage: string,
): string {
  const s = String(serviceDesignStage ?? "").trim() as RequirementsWorkspaceStage | "";
  switch (s) {
    case "product-definition":
      return PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION;
    case "ideation":
      return PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION;
    case "service-flow":
      return PROJECT_PROCESS_STAGES.REQUIREMENTS_SERVICE_FLOW;
    case "feature-planning":
      return PROJECT_PROCESS_STAGES.FEATURE_PLANNING;
    case "implementation":
      return PROJECT_PROCESS_STAGES.PROTOTYPE_BUILD;
    default:
      return fallbackStage.trim() || PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION;
  }
}

export function resolveProcessStageForRequirementsMessage(
  message: RequirementsMessage,
  fallbackStage: string,
): string {
  const fromMeta = message.meta?.serviceDesignStage;
  return mapServiceDesignStageToProcessStage(fromMeta, fallbackStage);
}

/**
 * Returns requirements conversation messages that should be appended to the Event Store.
 * Skips messages without id/content and messages already present in previousConversationJson.
 */
export function extractRequirementsMessagesForEventStore(input: Readonly<{
  readonly previousConversationJson?: unknown | null;
  readonly nextConversationJson: unknown;
  readonly fallbackStage?: string;
}>): ExtractedRequirementsMessageForEventStore[] {
  const fallback = input.fallbackStage ?? PROJECT_PROCESS_STAGES.REQUIREMENTS_IDEATION;
  const previousIds = collectMessageIds(input.previousConversationJson);
  const seenNext = new Set<string>();
  const out: ExtractedRequirementsMessageForEventStore[] = [];

  for (const raw of readConversationMessages(input.nextConversationJson)) {
    const message = coerceRequirementsMessage(raw);
    if (!message) continue;
    const id = String(message.id ?? "").trim();
    const content = String(message.content ?? "").trim();
    if (!id || !content) continue;
    if (previousIds.has(id)) continue;
    if (seenNext.has(id)) continue;
    seenNext.add(id);
    out.push({
      message,
      stage: resolveProcessStageForRequirementsMessage(message, fallback),
    });
  }

  return out;
}
