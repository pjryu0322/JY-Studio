import { NextRequest, NextResponse } from "next/server";
import { requireTaskCursorWorkerAuth } from "@/lib/prototype/taskCursorWorkerAuth";
import { claimTaskCursorJobsForWorker } from "@/lib/prototype/taskCursorWorkerService";
import { toTaskCursorJobSummary } from "@/lib/prototype/taskCursorExecutionJobTypes";

export async function POST(request: NextRequest) {
  const denied = requireTaskCursorWorkerAuth(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as { readonly workerId?: string; readonly limit?: number };
    const workerId = String(body.workerId ?? request.headers.get("x-worker-id") ?? "worker").trim();
    const limit = Number(body.limit ?? 1);
    const jobs = await claimTaskCursorJobsForWorker({ workerId, limit });
    return NextResponse.json({
      success: true,
      claimed: jobs.map((job) => toTaskCursorJobSummary(job)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
