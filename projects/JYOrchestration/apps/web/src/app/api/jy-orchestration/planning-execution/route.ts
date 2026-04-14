/**
 * **HTTP attachment (draft)** for planning-originated execution.
 *
 * - **External surface:** JSON matching {@link import("@jy-orch/http/jyOrchestration/planningOriginatedExecutionRequestDto").PlanningOriginatedExecutionRequestDto}
 *   on input, and {@link import("@jy-orch/application/contracts/planningOriginatedExecutionResponse").PlanningOriginatedExecutionResponse} on success.
 * - **Integration path:** validate request → `mvpRunPlanningOriginatedExecutionUseCase` → `presentPlanningOriginatedExecutionResult`.
 * - **Not a public surface:** raw planning handoff, execution preparation bundle, bridge input, or seed payload.
 *
 * Route handlers stay thin: no direct planning step orchestration, no `executionService` calls, no ad hoc reshaping of engine internals.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import {
  mvpRunPlanningOriginatedExecutionUseCase,
  presentPlanningOriginatedExecutionResult,
} from "@jy-orch/application/public";
import {
  badRequestBody,
  parsePlanningExecutionRequest,
  planningOriginatedExecutionInputFromDto,
} from "@jy-orch/http/jyOrchestration/planningOriginatedExecutionRequestDto";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(badRequestBody(["body must be valid JSON"]), { status: 400 });
    }

    const parsed = parsePlanningExecutionRequest(body);
    if (!parsed.ok) {
      return NextResponse.json(badRequestBody(parsed.issues), { status: 400 });
    }

    const { dto } = parsed;
    try {
      await requireProjectPermissionById(
        dto.projectId,
        userId,
        "canRunTask",
        "POST /api/jy-orchestration/planning-execution"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const input = planningOriginatedExecutionInputFromDto(dto);
    const facadeResult = await mvpRunPlanningOriginatedExecutionUseCase(input);
    const responseBody = presentPlanningOriginatedExecutionResult(facadeResult);
    return NextResponse.json(responseBody, { status: 200 });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/jy-orchestration/planning-execution error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Planning execution request failed." }, { status: 500 });
  }
}
