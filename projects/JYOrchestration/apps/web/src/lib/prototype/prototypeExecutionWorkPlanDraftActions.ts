import {
  buildImplementationWorkPlanDraft,
  buildImplementationWorkPlanDraftConfirmedTimelineEntry,
  buildImplementationWorkPlanDraftTimelineEntry,
  buildWorkPlanDraftMessage,
  hasImplementationWorkPlanDraftMessage,
  type ImplementationWorkPlanDraftV1,
} from "@/lib/prototype/implementationWorkPlanDraft";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type GenerateWorkPlanDraftResult =
  | Readonly<{ readonly kind: "already_exists" }>
  | Readonly<{
      readonly kind: "created";
      readonly draft: ImplementationWorkPlanDraftV1;
      readonly messages: readonly RequirementsMessage[];
      readonly orchestrationPatch: {
        readonly implementationWorkPlanDraftV1: ImplementationWorkPlanDraftV1;
        readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
      };
    }>;

export function buildGenerateImplementationWorkPlanDraftResult(input: {
  readonly requirementsStateJson: unknown;
  readonly projectId: string;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso?: string;
}): GenerateWorkPlanDraftResult {
  const resolved = resolvePrototypeExecutionSingleChatFromState(input.requirementsStateJson);
  const prior = resolved.messages ?? [];
  if (hasImplementationWorkPlanDraftMessage(prior)) {
    return { kind: "already_exists" };
  }

  const draft = buildImplementationWorkPlanDraft({
    projectId: input.projectId,
    projectArtifacts: input.projectArtifacts,
    envOk: input.envOk,
    designOk: input.designOk,
    nowIso: input.nowIso,
  });
  const draftMsg = buildWorkPlanDraftMessage(draft, { nowIso: input.nowIso });
  const timeline = appendPromptTimeline(
    input.promptTimeline,
    buildImplementationWorkPlanDraftTimelineEntry({ draft, nowIso: input.nowIso }),
  );

  return {
    kind: "created",
    draft,
    messages: [...prior, draftMsg],
    orchestrationPatch: {
      implementationWorkPlanDraftV1: draft,
      promptTimeline: timeline,
    },
  };
}

export function markImplementationWorkPlanDraftConfirmed(
  draft: ImplementationWorkPlanDraftV1,
  nowIso?: string,
): ImplementationWorkPlanDraftV1 {
  const now = nowIso ?? new Date().toISOString();
  return { ...draft, status: "confirmed", updatedAt: now };
}

export function buildWorkPlanDraftConfirmedTimeline(
  draft: ImplementationWorkPlanDraftV1,
  promptTimeline: readonly RequirementsPromptTimelineEntry[] | undefined,
  nowIso?: string,
): readonly RequirementsPromptTimelineEntry[] {
  return appendPromptTimeline(
    promptTimeline,
    buildImplementationWorkPlanDraftConfirmedTimelineEntry({ draft, nowIso }),
  );
}
