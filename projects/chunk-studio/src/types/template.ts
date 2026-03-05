import type { LayoutProfile } from "@/lib/template/templateDetector";

export interface TemplateRecommendation {
  templateId: string;
  version: string;
  confidence: number;
  reasons: string[];
}

export interface TemplateApplyPreview {
  templateId: string;
  version: string;
  chunks: Array<{
    id: string;
    type: "section" | "table" | "repeat";
    text: string;
    meta: {
      templateId: string;
      sectionId?: string;
      sectionTitle?: string;
      headerLabels?: string[];
    };
  }>;
  chunkMeta: {
    total: number;
    sectionChunks: number;
    tableChunks: number;
    repeatChunks: number;
  };
}

export interface TemplateRecommendResponse {
  profile: LayoutProfile;
  recommendations: TemplateRecommendation[];
}

export interface AutoDetectSectionDTO {
  title: string;
  bbox: { page: number; x: number; y: number; w: number; h: number };
  confidence: number;
  level?: number;
}

export interface AutoDetectFieldDTO {
  label: string;
  bbox: { page: number; x: number; y: number; w: number; h: number };
  confidence: number;
}

export interface AutoDetectTableDTO {
  name: string;
  headerLabels: string[];
  bbox: { page: number; x: number; y: number; w: number; h: number };
  confidence: number;
}

export interface TemplateAutoDetectResponse {
  docType: "form" | "weekly_report" | "monthly_report" | "meeting_minutes" | "unknown";
  sections: AutoDetectSectionDTO[];
  fields: AutoDetectFieldDTO[];
  tables: AutoDetectTableDTO[];
  confidence: number;
  reasons?: string[];
  topSignals?: string[];
  matchedLabels?: string[];
  draftTemplate?: {
    templateId: string;
    version: string;
    sections: Array<{
      id: string;
      title: string;
      level: number;
      bboxHint?: { page: number; x: number; y: number; w: number; h: number };
    }>;
    fields: Array<{
      key: string;
      label: string;
      bboxHint?: { page: number; x: number; y: number; w: number; h: number };
    }>;
    tables: Array<{
      id: string;
      headerLabels: string[];
      bboxHint?: { page: number; x: number; y: number; w: number; h: number };
    }>;
  };
}

export interface TemplateDiffResponse {
  fieldsChanged: Array<{
    key: string;
    label: string;
    oldValue: string;
    newValue: string;
    changeType: "added" | "removed" | "modified" | "unchanged";
  }>;
  sectionsChanged: Array<{
    sectionId: string;
    title: string;
    oldText: string;
    newText: string;
    similarity: number;
    changeType: "minor change" | "major change" | "unchanged";
  }>;
  tablesChanged: Array<{
    tableId: string;
    headerLabels: string[];
    addedRows: string[];
    removedRows: string[];
    modifiedRows: Array<{ oldRow: string; newRow: string }>;
  }>;
  repeatChanged?: Array<{
    pattern: string;
    added: string[];
    removed: string[];
  }>;
}

