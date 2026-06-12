import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { PrototypeExecutionInterviewSlot } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";

export type ImplementationStageChatPatch = Readonly<{
  readonly messages: readonly RequirementsMessage[];
  readonly slots: readonly PrototypeExecutionInterviewSlot[];
  readonly answers: Readonly<Record<string, string>>;
  readonly currentSlotKey: string | null;
}>;

export function readImplementationStageChatPatch(requirementsStateJson: unknown): ImplementationStageChatPatch {
  const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
  return {
    messages: resolved.messages ?? [],
    slots: resolved.slots ?? [],
    answers: resolved.answers ?? {},
    currentSlotKey: resolved.currentSlotKey ?? null,
  };
}

export function readImplementationStageChatMessages(requirementsStateJson: unknown): readonly RequirementsMessage[] {
  return readImplementationStageChatPatch(requirementsStateJson).messages;
}
