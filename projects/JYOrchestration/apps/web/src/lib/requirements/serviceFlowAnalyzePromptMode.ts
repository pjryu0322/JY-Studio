/**
 * service-flow analyze system prompt mode — structural subIntent beats advice.
 */

import { isAdviceToFlowApplyMode } from "@/lib/requirements/serviceFlowAdviceApplyMode";
import { isServiceFlowAdviceMode } from "@/lib/requirements/serviceFlowAdviceMode";
import {
  getServiceFlowSubIntentFromPolicy,
  type ServiceFlowSubIntent,
} from "@/lib/requirements/serviceFlowSubIntent";

export type ServiceFlowAnalyzePromptMode =
  | "advice_to_flow_apply"
  | "actor_definition"
  | "flow_step_definition"
  | "advice"
  | "proposal";

export function resolveServiceFlowAnalyzePromptMode(input: {
  readonly adviceToFlowApplyMode: boolean;
  readonly adviceMode: boolean;
  readonly serviceFlowSubIntent?: ServiceFlowSubIntent | null;
}): ServiceFlowAnalyzePromptMode {
  if (input.adviceToFlowApplyMode) return "advice_to_flow_apply";
  if (input.serviceFlowSubIntent === "actor_definition") return "actor_definition";
  if (
    input.serviceFlowSubIntent === "flow_step_definition" ||
    input.serviceFlowSubIntent === "flow_draft" ||
    input.serviceFlowSubIntent === "flow_edit"
  ) {
    return "flow_step_definition";
  }
  if (input.adviceMode) return "advice";
  return "proposal";
}

export function resolveServiceFlowAnalyzePromptModeFromPolicy(
  responsePolicy: unknown,
): ServiceFlowAnalyzePromptMode {
  return resolveServiceFlowAnalyzePromptMode({
    adviceToFlowApplyMode: isAdviceToFlowApplyMode(responsePolicy),
    adviceMode: isServiceFlowAdviceMode(responsePolicy),
    serviceFlowSubIntent: getServiceFlowSubIntentFromPolicy(responsePolicy),
  });
}
