import { useCallback } from "react";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  resolveReferencePlanningNoticeCandidate,
  type ReferencePlanningNoticeCandidate,
} from "@/lib/project-knowledge/projectKnowledgeReferencePlanningNotice";

type NoticeMessageLike = Readonly<{ readonly meta?: { readonly internalType?: string } | null }>;

export function useResolveReferencePlanningNotice() {
  return useCallback(
    (input: Readonly<{
      readonly workspaceState: RequirementsStateJson;
      readonly existingMessages: readonly NoticeMessageLike[];
      readonly nowIso?: string;
    }>): ReferencePlanningNoticeCandidate =>
      resolveReferencePlanningNoticeCandidate({
        workspaceState: input.workspaceState,
        existingMessages: input.existingMessages,
        nowIso: input.nowIso ?? new Date().toISOString(),
      }),
    [],
  );
}

export { resolveReferencePlanningNoticeCandidate, type ReferencePlanningNoticeCandidate };
