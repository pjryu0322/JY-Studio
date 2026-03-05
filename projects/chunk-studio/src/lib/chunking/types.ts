export type BlockType =
  | "heading"
  | "paragraph"
  | "list_item"
  | "table"
  | "figure_caption";

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TableStruct {
  tableId: string;
  caption?: string;
  header?: string[];
  rows: string[][];
  rowsText: string[];
}

export interface OcrQualitySignal {
  avgConfidence?: number;
  unknownCharRatio?: number;
  symbolNoiseRatio?: number;
  brokenSpacingScore?: number;
}

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  level?: number;
  depth?: number;
  tableId?: string;
  tableStruct?: TableStruct;
  page?: number;
  bbox?: BBox;
  blockIndex: number;
}

export type ChunkWarning =
  | "TOO_LONG"
  | "TOO_SHORT"
  | "MISSING_LEAD"
  | "HEADER_NOISE"
  | "OCR_LOW_CONF"
  | "OCR_GARBLED"
  | "HIGH_SYMBOL_NOISE";

export interface ChunkQuality {
  tokens: number;
  hasConstraints: boolean;
  hasTable: boolean;
  hasList: boolean;
  warnings: ChunkWarning[];
}

export interface ChunkMeta {
  chunkId: string;
  type: "section" | "paragraph" | "table" | "repeat_item" | "list";
  sectionPath: string[];
  sourceBlockIds: string[];
  startBlockIdx: number;
  endBlockIdx: number;
  pageRange?: [number, number];
  bboxList?: BBox[];
  quality: ChunkQuality;
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
  pipelineVersion: string;
}

export interface Chunk {
  text: string;
  meta: ChunkMeta;
}

export interface ChunkConfig {
  targetTokens: number;
  maxTokens: number;
  minTokens: number;
  overlapTokens: number; // backward compatibility
  overlapSentences: number;
  headerFooterThreshold: number;
  enableConstraintRules: boolean;
  forcePositionalCleaning?: boolean;
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  targetTokens: 550,
  maxTokens: 900,
  minTokens: 150,
  overlapTokens: 80,
  overlapSentences: 2,
  headerFooterThreshold: 0.6,
  enableConstraintRules: true,
};

export const CHUNK_PRESETS: Record<
  "RFP_DEFAULT" | "SHORT" | "LONG" | "REQUIREMENT_FIRST",
  ChunkConfig
> = {
  RFP_DEFAULT: {
    targetTokens: 550,
    maxTokens: 900,
    minTokens: 150,
    overlapTokens: 80,
    overlapSentences: 2,
    headerFooterThreshold: 0.6,
    enableConstraintRules: true,
    forcePositionalCleaning: false,
  },
  SHORT: {
    targetTokens: 350,
    maxTokens: 550,
    minTokens: 100,
    overlapTokens: 60,
    overlapSentences: 1,
    headerFooterThreshold: 0.65,
    enableConstraintRules: true,
    forcePositionalCleaning: false,
  },
  LONG: {
    targetTokens: 800,
    maxTokens: 1200,
    minTokens: 250,
    overlapTokens: 100,
    overlapSentences: 3,
    headerFooterThreshold: 0.55,
    enableConstraintRules: true,
    forcePositionalCleaning: false,
  },
  REQUIREMENT_FIRST: {
    targetTokens: 450,
    maxTokens: 750,
    minTokens: 130,
    overlapTokens: 100,
    overlapSentences: 3,
    headerFooterThreshold: 0.6,
    enableConstraintRules: true,
    forcePositionalCleaning: false,
  },
};

export interface CleaningLog {
  method: "freq" | "pos+freq";
  params: {
    threshold: number;
    topBand?: number;
    bottomBand?: number;
  };
  removed: Array<{
    kind: "header" | "footer" | "repeat_line";
    text: string;
    count: number;
    evidence?: Record<string, unknown>;
  }>;
}

export interface DiffStats {
  chunkCount: number;
  avgTokens: number;
  warnings: Record<string, number>;
  tags: Record<string, number>;
}

export interface ChunkDiffSummary {
  before: DiffStats;
  after: DiffStats;
  delta: {
    chunkCount: number;
    avgTokens: number;
  };
  warningsDelta: Record<string, number>;
  tagsDelta: Record<string, number>;
  removedTextSample?: string[];
}

