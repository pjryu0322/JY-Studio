import type { ProjectFromChatDraftPayloadV1 } from "@/lib/messenger/projectFromChatDraftTypes";
import { upsertProductDefinitionArtifact } from "@/lib/requirements/productDefinitionArtifact";
import { buildInitialProductDefinitionOrchestrationStage } from "@/lib/requirements/productDefinitionOrchestration";
import {
  buildProductDefinitionFromChatDraft,
  buildProductDefinitionStubFromProject,
  type ProductDefinitionV1,
} from "@/lib/requirements/productDefinitionV1";
import { mergeRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export function buildInitialProductDefinitionForProject(input: Readonly<{
  readonly productName: string;
  readonly description?: string | null;
  readonly draft?: ProjectFromChatDraftPayloadV1 | null;
  readonly nowIso?: string;
}>): ProductDefinitionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  if (input.draft) {
    return buildProductDefinitionFromChatDraft({
      productName: input.productName,
      description: input.description,
      draft: input.draft,
      nowIso: now,
    });
  }
  return buildProductDefinitionStubFromProject({
    productName: input.productName,
    description: input.description,
    nowIso: now,
  });
}

export function buildInitialRequirementsStateForNewProject(input: Readonly<{
  readonly name: string;
  readonly description: string | null;
  readonly projectFromChatDraft?: ProjectFromChatDraftPayloadV1 | null;
  readonly nowIso?: string;
}>): RequirementsStateJson {
  const now = input.nowIso ?? new Date().toISOString();
  const def = buildInitialProductDefinitionForProject({
    productName: input.name,
    description: input.description,
    draft: input.projectFromChatDraft ?? null,
    nowIso: now,
  });
  const patch: Partial<RequirementsStateJson> = {
    originalProjectDescription: input.description ?? "",
    requirementsOrchestrationStageV1: buildInitialProductDefinitionOrchestrationStage(now),
    productDefinitionV1: def,
    projectArtifacts: upsertProductDefinitionArtifact(null, def, now),
  };
  const draft = input.projectFromChatDraft;
  if (draft && typeof draft === "object") {
    patch.seededFromPreProjectChat = true;
    if (Array.isArray(draft.openQuestions) && draft.openQuestions.length) {
      patch.openIssues = draft.openQuestions.map((s) => String(s)).join("\n");
    }
    if (Array.isArray(draft.featureCandidates) && draft.featureCandidates.length) {
      patch.priorityFeatures = draft.featureCandidates.map((s) => String(s)).join("\n");
    }
  }
  return mergeRequirementsStateJson({}, patch);
}
