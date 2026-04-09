/**
 * Lightweight selectors for business launch handoff record (pre-execution only).
 */

import type { BusinessLaunchHandoffRecord } from "@/lib/workflow/businessLaunchHandoffRecord";
import {
  isBusinessLaunchHandoffRecordCurrent,
} from "@/lib/workflow/businessLaunchHandoffRecord";
import { getBusinessLaunchIntentStateForSession } from "@/lib/workflow/businessLaunchIntentGate";
import { resolveSessionBusinessLaunchHandoffRecord } from "@/lib/workflow/businessExecutionRequestStore";
import type { ExecutionLaunchSnapshot } from "@/lib/workflow/executionLaunchSnapshot";

export function resolveBusinessLaunchHandoffRecord(
  sessionId: string | null | undefined
): BusinessLaunchHandoffRecord | undefined {
  return resolveSessionBusinessLaunchHandoffRecord(sessionId);
}

export { isBusinessLaunchHandoffRecordCurrent as isCurrentBusinessLaunchHandoffRecord };

export function getBusinessLaunchHandoffStateForSession(
  sessionId: string | null | undefined,
  ctx: {
    snapshot: ExecutionLaunchSnapshot | undefined;
    currentCandidateTaskIds: string[];
    currentConfirmedTaskIds: string[];
  }
): ReturnType<typeof getBusinessLaunchIntentStateForSession> & {
  businessLaunchHandoffRecord: BusinessLaunchHandoffRecord | undefined;
  isBusinessLaunchHandoffRecordCurrent: boolean;
} {
  const base = getBusinessLaunchIntentStateForSession(sessionId, ctx);
  const businessLaunchHandoffRecord = resolveSessionBusinessLaunchHandoffRecord(sessionId);
  const isHandoffCurrent = isBusinessLaunchHandoffRecordCurrent({
    record: businessLaunchHandoffRecord,
    intent: base.businessLaunchIntent,
    readiness: base.executionReadiness,
    workOrder: base.workOrder,
    sessionId,
  });
  return {
    ...base,
    businessLaunchHandoffRecord,
    isBusinessLaunchHandoffRecordCurrent: isHandoffCurrent,
  };
}
