import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { CodeAgentWipOrchestrationPatch } from "@/lib/prototype/prototypeExecutionCodeAgentWipActions";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { PrototypeExecutionInterviewSlot } from "@/lib/prototype/prototypeExecutionSingleChatTypes";

export type PrototypeOrchestrationResultKind = "blocked" | "failed" | "completed";

export type PrototypeOrchestrationResult = Readonly<{
  readonly kind: PrototypeOrchestrationResultKind;
  readonly message: string;
  readonly chatPatch?: {
    readonly messages: readonly RequirementsMessage[];
    readonly slots: readonly PrototypeExecutionInterviewSlot[];
    readonly answers: Readonly<Record<string, string>>;
    readonly currentSlotKey: string | null;
  };
  readonly orchestrationPatch?: CodeAgentWipOrchestrationPatch;
}>;

export type PrototypeOrchestrationChatContext = Readonly<{
  readonly priorMessages: readonly RequirementsMessage[];
  readonly slots: readonly PrototypeExecutionInterviewSlot[];
  readonly answers: Readonly<Record<string, string>>;
  readonly currentSlotKey: string | null;
}>;

export function resolvePrototypeOrchestrationChatContext(
  requirementsStateJson: unknown,
): PrototypeOrchestrationChatContext {
  const resolved = resolvePrototypeExecutionSingleChatFromState(requirementsStateJson);
  return {
    priorMessages: resolved.messages ?? [],
    slots: resolved.slots ?? [],
    answers: resolved.answers ?? {},
    currentSlotKey: resolved.currentSlotKey ?? null,
  };
}

export function buildPrototypeOrchestrationResult(input: {
  readonly kind: PrototypeOrchestrationResultKind;
  readonly message: string;
  readonly requirementsStateJson: unknown;
  readonly newMessages: readonly RequirementsMessage[];
  readonly orchestrationPatch?: CodeAgentWipOrchestrationPatch;
}): PrototypeOrchestrationResult {
  const chat = resolvePrototypeOrchestrationChatContext(input.requirementsStateJson);
  return {
    kind: input.kind,
    message: input.message,
    chatPatch: {
      messages: [...chat.priorMessages, ...input.newMessages],
      slots: chat.slots,
      answers: chat.answers,
      currentSlotKey: chat.currentSlotKey,
    },
    ...(input.orchestrationPatch ? { orchestrationPatch: input.orchestrationPatch } : {}),
  };
}
