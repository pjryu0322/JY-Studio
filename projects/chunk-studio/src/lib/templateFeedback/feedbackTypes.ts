export type FeedbackEventType =
  | "SECTION_RENAME"
  | "FIELD_RELABEL"
  | "SECTION_ADD"
  | "SECTION_REMOVE"
  | "FIELD_ADD"
  | "FIELD_REMOVE"
  | "TABLE_ADD"
  | "TABLE_REMOVE"
  | "REPEAT_ADD"
  | "REPEAT_REMOVE";

export type FeedbackTargetType = "section" | "field" | "table" | "repeat";

export interface TemplateFeedbackEvent {
  eventType: FeedbackEventType;
  family: string;
  docType: string;
  templateId: string;
  docId: string;
  beforeValue?: string;
  afterValue?: string;
  targetType: FeedbackTargetType;
  targetId?: string;
  timestamp: string;
}
