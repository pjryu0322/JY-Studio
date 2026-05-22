import type { ConversationIntentClassification } from "@/lib/conversation-core/conversationIntentTypes";
import type { WebsiteInspectionResult } from "@/lib/conversation-core/websiteInspection";

const MAX_META_REASON = 500;

function formatList(key: string, items: readonly string[]): string {
  if (!items.length) return `${key}=[]`;
  return `${key}=[${items.map((x) => JSON.stringify(x)).join(", ")}]`;
}

export function formatConversationPromptMeta(
  classification: ConversationIntentClassification,
  extra?: {
    readonly layout?: string;
    readonly roomId?: string;
    readonly projectId?: string | null;
    readonly domainContextInjected?: readonly string[];
    readonly classifierRawPreview?: string;
    /** prompt에 주입된 contextBlocks (formatAiPlannerContextBlocksForTimeline) */
    readonly contextBlocks?: string;
    readonly inspection?: WebsiteInspectionResult | null;
  }
): string {
  const domainInjected =
    extra?.domainContextInjected ??
    (classification.shouldInjectDocumentContext ? ["document_collaboration"] : []);
  const lines = [
    "[promptMeta]",
    `scope=${classification.scope}`,
    `participationMode=${classification.participationMode}`,
    `mode=${classification.mode}`,
    `confidence=${classification.confidence.toFixed(2)}`,
    `classifierSource=${classification.classifierSource ?? "rules"}`,
    /rules_override/i.test(String(classification.reason ?? "")) ? "modeOverride=rules_guard" : "",
    `reason=${String(classification.reason ?? "").trim().slice(0, MAX_META_REASON)}`,
    `domainContextInjected=[${domainInjected.join(", ")}]`,
    classification.domainContextReason ? `domainContextReason=${classification.domainContextReason}` : "",
    formatList("userConstraints", classification.userConstraints),
    formatList("discardedDirections", classification.discardedDirections),
    formatList("openOptions", classification.openOptions),
    classification.requiredAction ? `requiredAction=${classification.requiredAction}` : "",
    classification.targetUrls?.length ? `targetUrls=[${classification.targetUrls.join(", ")}]` : "",
    extra?.inspection
      ? `inspectionOk=${extra.inspection.ok}`
      : classification.requiredAction === "website_inspection"
        ? "inspectionOk=false"
        : "",
    extra?.inspection?.status != null ? `inspectionStatus=${extra.inspection.status}` : "",
    extra?.inspection?.error ? `inspectionError=${extra.inspection.error}` : "",
    extra?.layout ? `layout=${extra.layout}` : "",
    extra?.roomId ? `roomId=${extra.roomId}` : "",
    extra?.projectId !== undefined ? `projectId=${String(extra.projectId ?? "").trim()}` : "",
    extra?.classifierRawPreview
      ? `classifierPreview=${extra.classifierRawPreview.trim().slice(0, 2000)}`
      : "",
  ].filter(Boolean);
  const meta = lines.join("\n");
  const blocks = String(extra?.contextBlocks ?? "").trim();
  if (!blocks) return meta;
  return `${meta}\n\n[contextBlocks]\n${blocks}`;
}
