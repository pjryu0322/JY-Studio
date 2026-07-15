import type { PipelineStatus } from "@prisma/client";

/** User-facing knowledge-generation stages mapped onto existing PipelineStatus values. */
export const DOCLING_KNOWLEDGE_STAGES = [
  {
    id: "STRUCTURE",
    pipelineStep: "STRUCTURE_VALIDATING" as PipelineStatus,
    label: "문서 구조 확인",
    description: "후속 지식 생성이 가능한 문서 구조인지 확인합니다.",
  },
  {
    id: "KNOWLEDGE_UNIT",
    pipelineStep: "KNOWLEDGE_CHECKING" as PipelineStatus,
    label: "지식 단위 생성",
    description: "정규화 문서를 의미 단위의 지식 단위로 변환합니다.",
  },
  {
    id: "RETRIEVAL_CHUNK",
    pipelineStep: "CHUNKING" as PipelineStatus,
    label: "검색 데이터 생성",
    description: "지식 단위에서 검색용 Chunk를 생성합니다.",
  },
  {
    id: "SEARCH_INDEX",
    pipelineStep: "INDEXING" as PipelineStatus,
    label: "검색 인덱스 생성",
    description: "검수 전 Draft 검색 Index(Embedding)를 구축합니다.",
  },
  {
    id: "RETRIEVAL_EVALUATION",
    pipelineStep: "SEARCH_EVALUATING" as PipelineStatus,
    label: "검색 결과 검증",
    description: "평가 질문으로 검색 결과 품질을 검증합니다.",
  },
] as const;

export type DoclingKnowledgeStageId = (typeof DOCLING_KNOWLEDGE_STAGES)[number]["id"];

export const DOCLING_KNOWLEDGE_PIPELINE_TRIGGER = "DOCLING_KNOWLEDGE_GENERATION";
export const DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE = "DOCLING_KNOWLEDGE_UNIT";
export const DOCLING_RETRIEVAL_CHUNK_TYPE = "DOCLING_RETRIEVAL_CHUNK";

export const DOCLING_KNOWLEDGE_PIPELINE_STEPS: PipelineStatus[] = [
  ...DOCLING_KNOWLEDGE_STAGES.map((s) => s.pipelineStep),
  "READY_FOR_REVIEW",
];

export function stageIdForPipelineStep(step: string): DoclingKnowledgeStageId | null {
  const hit = DOCLING_KNOWLEDGE_STAGES.find((s) => s.pipelineStep === step);
  return hit?.id ?? null;
}

export function userLabelForPipelineStep(step: string): string {
  const hit = DOCLING_KNOWLEDGE_STAGES.find((s) => s.pipelineStep === step);
  if (hit) return hit.label;
  if (step === "READY_FOR_REVIEW") return "지식 데이터 생성 완료";
  if (step === "FAILED") return "실패";
  return step;
}
