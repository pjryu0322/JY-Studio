/**
 * serviceFlow 구조 신호 → orchestration slot capability (slotKey path 기반, label 비교 금지).
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";

/** flow에서 추출한 구조 capability */
export type ServiceFlowStructuralCapability =
  | "actors.present"
  | "actors.human"
  | "actors.system"
  | "actors.multi_human"
  | "workflow.steps"
  | "workflow.depth_moderate"
  | "workflow.collaboration"
  | "workflow.approval"
  | "workflow.exception"
  | "workflow.operations"
  | "automation.system_actors"
  | "integration.external_hint";

/** slotKey path suffix → 필요 capability */
const SLOT_PATH_CAPABILITIES: Readonly<Record<string, readonly ServiceFlowStructuralCapability[]>> = {
  ".planning.coreUsers": ["actors.human"],
  ".flow.actorTypes": ["actors.present"],
  ".flow.permissionRelations": ["actors.multi_human", "workflow.approval"],
  ".flow.serviceFlow": ["workflow.steps"],
  ".flow.collaborationFlow": ["workflow.collaboration", "actors.multi_human"],
  ".flow.externalIntegration": ["integration.external_hint"],
  ".flow.exceptionFlow": ["workflow.exception"],
  ".flow.operationsFlow": ["workflow.operations", "workflow.depth_moderate"],
  ".flow.approvalFlow": ["workflow.approval"],
  ".flow.userStateChange": ["workflow.steps"],
  ".architecture.automationLevel": ["automation.system_actors", "workflow.steps"],
};

const COLLABORATION_STEP_SIGNAL =
  /검토|협업|공동|승인|확정|결재|review|approve|collaborat/i;
const APPROVAL_STEP_SIGNAL = /승인|확정|결재|approve|sign.?off/i;
const EXCEPTION_STEP_SIGNAL = /예외|반려|재처리|오류|실패|수정|rollback|retry/i;
const OPERATIONS_STEP_SIGNAL = /운영|모니터|백오피스|지원|ops|monitor/i;
const EXTERNAL_STEP_SIGNAL = /연동|API|webhook|import|export|동기화|integration/i;

function stepBlob(flow: RequirementsServiceFlowV1): string {
  return [...(flow.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => `${s.title} ${s.purpose}`)
    .join(" ");
}

export function extractServiceFlowStructuralCapabilities(
  flow: RequirementsServiceFlowV1,
): ReadonlySet<ServiceFlowStructuralCapability> {
  const caps = new Set<ServiceFlowStructuralCapability>();
  const actors = flow.actors ?? [];
  const steps = flow.steps ?? [];
  const humans = actors.filter((a) => a.kind === "human");
  const systems = actors.filter((a) => a.kind === "system");

  if (actors.length) caps.add("actors.present");
  if (humans.length) caps.add("actors.human");
  if (systems.length) caps.add("actors.system");
  if (humans.length >= 2) caps.add("actors.multi_human");
  if (systems.length >= 1 && steps.length >= 2) caps.add("automation.system_actors");

  if (steps.length >= 2) caps.add("workflow.steps");
  if (steps.length >= 4) caps.add("workflow.depth_moderate");

  const blob = stepBlob(flow);
  if (COLLABORATION_STEP_SIGNAL.test(blob) || humans.length >= 2) {
    caps.add("workflow.collaboration");
  }
  if (APPROVAL_STEP_SIGNAL.test(blob)) caps.add("workflow.approval");
  if (EXCEPTION_STEP_SIGNAL.test(blob)) caps.add("workflow.exception");
  if (OPERATIONS_STEP_SIGNAL.test(blob)) caps.add("workflow.operations");
  if (EXTERNAL_STEP_SIGNAL.test(blob)) caps.add("integration.external_hint");

  return caps;
}

export function slotKeySemanticSuffix(slotKey: string): string | null {
  const k = String(slotKey ?? "").trim();
  for (const suffix of Object.keys(SLOT_PATH_CAPABILITIES)) {
    if (k.endsWith(suffix) || k.includes(suffix)) return suffix;
  }
  return null;
}

export function slotCapabilitiesForDefinition(
  def: SingleChatOrchestrationSlotDefinition,
): readonly ServiceFlowStructuralCapability[] {
  const suffix = slotKeySemanticSuffix(def.slotKey);
  if (!suffix) return [];
  return SLOT_PATH_CAPABILITIES[suffix] ?? [];
}

export function slotMatchesFlowCapabilities(
  def: SingleChatOrchestrationSlotDefinition,
  flowCaps: ReadonlySet<ServiceFlowStructuralCapability>,
): boolean {
  const required = slotCapabilitiesForDefinition(def);
  if (!required.length) return false;
  return required.some((c) => flowCaps.has(c));
}

/** service-flow-sync 대상 slot (flow/analysis/architecture 그룹) */
export function isServiceFlowSyncEligibleSlot(def: SingleChatOrchestrationSlotDefinition): boolean {
  return Boolean(slotKeySemanticSuffix(def.slotKey));
}
