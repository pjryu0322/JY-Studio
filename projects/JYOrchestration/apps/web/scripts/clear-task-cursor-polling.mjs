import { PrismaClient } from "@prisma/client";

const IN_FLIGHT_CURSOR = new Set(["cursor_requested", "cursor_running", "github_verifying"]);
const POST_CURSOR_PIPELINE = new Set([
  "github_verified",
  "review_pending",
  "security_pending",
  "scm_pending",
]);
const CANCEL_MESSAGE = "사용자가 Cloud Agent 폴링을 중단했습니다.";

function releaseAllPollingFromState(raw, nowIso) {
  if (!raw || typeof raw !== "object") {
    return { next: raw, released: [] };
  }
  const source = raw;
  const next = { ...source };
  const released = [];

  const execution = source.taskCursorExecutionV1;
  if (execution && typeof execution === "object") {
    const status = String(execution.status ?? "").trim();
    const taskId = String(execution.taskId ?? "").trim();
    if (taskId && (IN_FLIGHT_CURSOR.has(status) || POST_CURSOR_PIPELINE.has(status))) {
      released.push(`taskCursor:${taskId}:${status}`);
      next.taskCursorExecutionV1 = {
        ...execution,
        status: "status_check_stopped",
        errorMessage: CANCEL_MESSAGE,
        updatedAt: nowIso,
      };
    }
  }

  const autoGate = source.implementationAutoQualityGateV1;
  if (autoGate && typeof autoGate === "object") {
    const status = String(autoGate.status ?? "").trim();
    if (status === "running" || status === "queued") {
      released.push(`autoGate:${String(autoGate.taskId ?? "")}:${status}`);
      next.implementationAutoQualityGateV1 = {
        ...autoGate,
        status: "failed",
        failureReason: "poll_cancelled",
        updatedAt: nowIso,
      };
    }
  }

  const quickRun = source.implementationQuickRunV1;
  if (quickRun && typeof quickRun === "object") {
    const status = String(quickRun.status ?? "").trim();
    if (status === "running") {
      released.push("quickRun:running");
      next.implementationQuickRunV1 = {
        ...quickRun,
        status: "paused",
        updatedAt: nowIso,
        blockedReason: "폴링 일괄 해제",
      };
    }
  }

  return { next, released };
}

async function main() {
  const projectIdArg = process.argv[2]?.trim();
  const scanAll = !projectIdArg || projectIdArg.toLowerCase() === "all";
  const targetProjectId = scanAll ? null : projectIdArg;
  const prisma = new PrismaClient();
  const nowIso = new Date().toISOString();

  try {
    const projects = targetProjectId
      ? await prisma.project.findMany({
          where: { id: targetProjectId, deletedAt: null },
          select: { id: true, name: true, requirementsStateJson: true },
        })
      : await prisma.project.findMany({
          where: { deletedAt: null, requirementsStateJson: { not: null } },
          select: { id: true, name: true, requirementsStateJson: true },
        });

    let changedProjects = 0;
    for (const project of projects) {
      const { next, released } = releaseAllPollingFromState(project.requirementsStateJson, nowIso);
      if (!released.length) continue;
      await prisma.project.update({
        where: { id: project.id },
        data: { requirementsStateJson: next },
      });
      changedProjects += 1;
      console.log(`[released] ${project.id} ${project.name ?? ""}: ${released.join(", ")}`);
    }

    if (!changedProjects) {
      console.log(`No active polling pipeline found${targetProjectId ? ` for ${targetProjectId}` : ""}.`);
    } else {
      console.log(`Done. Updated ${changedProjects} project(s). Refresh the browser tab.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
