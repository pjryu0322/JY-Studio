import { NextRequest, NextResponse } from "next/server";
import { requireTaskCursorWorkerAuth } from "@/lib/prototype/taskCursorWorkerAuth";
import { releaseStaleTaskCursorJobLocks } from "@/lib/prototype/taskCursorExecutionJobRepository";

export async function POST(_request: NextRequest) {
  const denied = requireTaskCursorWorkerAuth(_request);
  if (denied) return denied;

  try {
    const released = await releaseStaleTaskCursorJobLocks(new Date());
    return NextResponse.json({ success: true, released });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
