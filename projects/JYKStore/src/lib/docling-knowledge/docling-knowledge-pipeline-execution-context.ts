/**
 * Mutable execution context shared across Docling knowledge pipeline stage runners.
 */
import {
  serializeKnowledgeRunBinding,
  type KnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { failDraftIndexGeneration } from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
import { finishPipelineRun } from "@/lib/pipeline-service";
import {
  assertKnowledgeRunLock,
  touchKnowledgeRunHeartbeat,
} from "@/workers/knowledge-pipeline-job-claim";

export type StageResult = { ok: true } | { ok: false };

export type DoclingPipelineExecutionContext = {
  packId: string;
  runId: string;
  lockOwner: string;
  versionId: string;
  indexGenerationId: string;
  binding: KnowledgeRunBinding;
  setBinding: (next: KnowledgeRunBinding) => void;
  heartbeat: (userMessage: string) => Promise<boolean>;
  assertOwned: () => Promise<boolean>;
  cancelledExit: (message: string) => Promise<void>;
};

export function createDoclingPipelineExecutionContext(input: {
  packId: string;
  runId: string;
  lockOwner: string;
  binding: KnowledgeRunBinding;
}): DoclingPipelineExecutionContext {
  let binding = input.binding;
  const versionId = binding.versionId;
  const indexGenerationId = binding.indexGenerationId;

  const ctx: DoclingPipelineExecutionContext = {
    packId: input.packId,
    runId: input.runId,
    lockOwner: input.lockOwner,
    versionId,
    indexGenerationId,
    get binding() {
      return binding;
    },
    setBinding(next) {
      binding = next;
    },
    async heartbeat(userMessage: string) {
      const next = await touchKnowledgeRunHeartbeat({
        runId: input.runId,
        lockOwner: input.lockOwner,
        userMessage,
      });
      if (!next) return false;
      binding = next;
      return true;
    },
    async assertOwned() {
      const owned = await assertKnowledgeRunLock({
        runId: input.runId,
        lockOwner: input.lockOwner,
      });
      if (!owned) return false;
      binding = owned;
      return true;
    },
    async cancelledExit(message: string) {
      await finishPipelineRun({
        runId: input.runId,
        status: "SKIPPED",
        summary: serializeKnowledgeRunBinding({
          ...binding,
          userMessage: message,
          failureCode: "PIPELINE_CANCELLED",
          lockOwner: null,
          lockExpiresAt: null,
        }),
      });
      await failDraftIndexGeneration({ versionId, indexGenerationId }).catch(() => undefined);
    },
  };

  return ctx;
}
