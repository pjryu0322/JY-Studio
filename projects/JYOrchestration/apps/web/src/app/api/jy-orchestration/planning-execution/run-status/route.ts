/**
 * Run-status read path for planning-originated execution.
 *
 * Boundary:
 * - UI calls this route only.
 * - This route calls the application use-case only.
 * - Returns a UI-safe normalized contract (no internal bundles).
 *
 * Note: MVP store currently cannot map runId → projectId here, so RBAC is limited to requiring a session.
 * Once run ownership/project mapping exists, add a permission check before returning run details.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { mvpReadPlanningExecutionRunStatusUseCase } from "@jy-orch/application/public";

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const runId = request.nextUrl.searchParams.get("runId") ?? "";
  const r = await mvpReadPlanningExecutionRunStatusUseCase({ runId });
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "INVALID_RUN_ID" ? 400 : 404 });
}

