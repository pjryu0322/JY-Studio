export type JobStatus =
  | "UPLOADED"
  | "ACTION_REQUIRED"
  | "QUEUED"
  | "CONVERTING"
  | "PDF_READY"
  | "EXTRACTING_TEXT"
  | "CHUNKING"
  | "DONE"
  | "FAILED";

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  message: string | null;
  originalFilename?: string;
  createdAt: string;
  updatedAt: string;
   errorDetail?: string | null;
}

export interface ChunkQualityDTO {
  tokens: number;
  hasConstraints: boolean;
  hasTable: boolean;
  hasList: boolean;
  warnings: string[];
}

export interface ChunkDTO {
  text: string;
  meta: {
    chunkId: string;
    type: "section" | "paragraph" | "table" | "repeat_item" | "list";
    noise?: boolean;
    sectionTitle?: string;
    sectionLevel?: number;
    sectionPath: string[];
    sourceBlockIds: string[];
    startBlockIdx: number;
    endBlockIdx: number;
    pageRange?: [number, number];
    bboxList?: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      page?: number;
    }>;
    pipelineVersion: string;
    tags: string[];
    searchText?: string;
    ocrQuality?: {
      avgConfidence?: number;
      unknownCharRatio?: number;
      symbolNoiseRatio?: number;
      brokenSpacingScore?: number;
    };
    normalized?: {
      deadlines?: string[];
      deliverables?: string[];
      evalItems?: Array<{ name: string; score?: number }>;
    };
    quality: ChunkQualityDTO;
  };
}

export interface ChunkReportDTO {
  totalChunks: number;
  avgTokens: number;
  minTokens: number;
  maxTokens: number;
  warningDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
}

export interface CleaningLogDTO {
  method: "freq" | "pos+freq";
  params: {
    threshold: number;
    topBand?: number;
    bottomBand?: number;
  };
  removedSummary: Array<{ kind: string; text: string; count: number }>;
  removedCount: number;
}

export interface ChunkDiffSummaryDTO {
  before: {
    chunkCount: number;
    avgTokens: number;
    warnings: Record<string, number>;
    tags: Record<string, number>;
  };
  after: {
    chunkCount: number;
    avgTokens: number;
    warnings: Record<string, number>;
    tags: Record<string, number>;
  };
  delta: {
    chunkCount: number;
    avgTokens: number;
  };
  warningsDelta: Record<string, number>;
  tagsDelta: Record<string, number>;
  removedTextSample?: string[];
}

export interface JobDetailDTO extends Job {
  extractionMethod: string | null;
  pipelineVersion: string | null;
  extractedText: string;
  chunks: ChunkDTO[];
  report: ChunkReportDTO | null;
  chunkQualityReport?: {
    totalChunks: number;
    sectionChunks: number;
    paragraphChunks: number;
    tableChunks: number;
    repeatChunks: number;
    tinyChunks: number;
    oversizedChunks: number;
    noiseChunksRemoved: number;
    orphanChunks: number;
    averageChunkLength: number;
  } | null;
  cleaningLog: CleaningLogDTO | null;
  diff: ChunkDiffSummaryDTO | null;
  ocrQuality?: {
    avgConfidence?: number;
    unknownCharRatio?: number;
    symbolNoiseRatio?: number;
    brokenSpacingScore?: number;
  } | null;
}
