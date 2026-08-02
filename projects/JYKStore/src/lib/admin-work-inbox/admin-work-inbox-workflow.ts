/**
 * Attach PackWorkflowSnapshot runtime summary to inbox rows.
 */
import type { PackWorkflowRuntimeSummary } from "@/lib/workflow/pack-workflow-facts";
import { batchLoadPackWorkflowFacts } from "@/lib/workflow/pack-workflow-facts-loader";
import {
  buildPackWorkflowSnapshot,
  toPackWorkflowRuntimeSummary,
} from "@/lib/workflow/pack-workflow-snapshot";

export type InboxWorkflowAttachment = PackWorkflowRuntimeSummary;

export async function batchAttachInboxWorkflow(
  packIds: readonly string[],
): Promise<Map<string, InboxWorkflowAttachment>> {
  const factsByPack = await batchLoadPackWorkflowFacts(packIds);
  const out = new Map<string, InboxWorkflowAttachment>();
  for (const [packId, facts] of factsByPack) {
    out.set(
      packId,
      toPackWorkflowRuntimeSummary(buildPackWorkflowSnapshot(facts)),
    );
  }
  return out;
}

export function withInboxWorkflow<T extends { packId: string }>(
  items: readonly T[],
  workflowByPack: Map<string, InboxWorkflowAttachment>,
): Array<T & { workflow: InboxWorkflowAttachment | null }> {
  return items.map((item) => ({
    ...item,
    workflow: workflowByPack.get(item.packId) ?? null,
  }));
}
