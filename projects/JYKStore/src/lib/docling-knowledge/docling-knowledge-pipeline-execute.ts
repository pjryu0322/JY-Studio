/**
 * Docling knowledge pipeline execute orchestration (structure stages only).
 */
import type { KnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { createDoclingPipelineExecutionContext } from "@/lib/docling-knowledge/docling-knowledge-pipeline-execution-context";
import { runStructureStage } from "@/lib/docling-knowledge/docling-knowledge-pipeline-runner-structure";
import { runKnowledgeUnitStage } from "@/lib/docling-knowledge/docling-knowledge-pipeline-runner-knowledge";
import {
  finalizeStructurePipelinePass,
  runRetrievalChunkStage,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-runner-chunk";

/**
 * Execute STRUCTURE → KNOWLEDGE_UNIT → RETRIEVAL_CHUNK, then await search-data.
 * Does not run SEARCH_INDEX / RETRIEVAL_EVALUATION / READY_FOR_REVIEW (search-data worker).
 */
export async function executeDoclingKnowledgePipeline(input: {
  runId: string;
  packId: string;
  binding: KnowledgeRunBinding;
  lockOwner: string;
}): Promise<void> {
  const ctx = createDoclingPipelineExecutionContext(input);

  if (!(await ctx.heartbeat("문서 구조 확인 준비"))) {
    await ctx.cancelledExit("취소되어 중단되었습니다.");
    return;
  }

  const structure = await runStructureStage(ctx);
  if (!structure.ok || !structure.materials) return;

  const knowledge = await runKnowledgeUnitStage(ctx, structure.materials);
  if (!knowledge.ok || !knowledge.built) return;

  const chunk = await runRetrievalChunkStage(ctx, knowledge.built);
  if (!chunk.ok) return;

  await finalizeStructurePipelinePass(ctx, knowledge.built);
}
