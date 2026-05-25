import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export const PROTOTYPE_EXECUTION_DERIVED_INTERNAL_TYPE = "PROTOTYPE_EXECUTION_DERIVED";

export type PrototypeExecutionInterviewSlot = Readonly<{
  key: string;
  title: string;
  question: string;
  required: boolean;
}>;

export type PrototypeExecutionSingleChatV1 = Readonly<{
  messages: readonly RequirementsMessage[];
  slots?: readonly PrototypeExecutionInterviewSlot[];
  answers?: Readonly<Record<string, string>>;
  currentSlotKey?: string | null;
  promptTimeline?: readonly RequirementsPromptTimelineEntry[];
  updatedAt?: string;
}>;
