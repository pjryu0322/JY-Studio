import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildRequirementsConversationResetStateJson } from "@/lib/requirements/requirementsWorkspaceHelpers";
import { resetProjectDownstreamFromPlanning } from "@/lib/requirements/planningResetCascadeService";
import { clearProjectGraphProjection } from "@/lib/project-graph/projectGraphProjection";
import { softDeleteProjectByOwner } from "@/lib/service/projectService";
import {
  assertChatRoomAccess,
  ChatRoomAccessError,
  deleteChatRoomForOwner,
} from "@/lib/service/chatRoomService";

export type DeleteChatRoomWithLinkedProjectResult = Readonly<{
  readonly ok: boolean;
  readonly roomDeleted: boolean;
  readonly linkedProjectReset: boolean;
  readonly projectId?: string | null;
  readonly warnings?: readonly string[];
  readonly message: string;
}>;

async function resetLinkedProjectDataForChatRoomDelete(
  projectId: string,
  warnings: string[],
): Promise<void> {
  const pid = projectId.trim();
  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  if (!project) {
    warnings.push("linkedProjectNotFound");
    return;
  }

  const nowIso = new Date().toISOString();
  const resetState = buildRequirementsConversationResetStateJson(
    parseRequirementsStateJson(project.requirementsStateJson),
    nowIso,
  );

  try {
    await resetProjectDownstreamFromPlanning({ projectId: pid, reason: "manual" });
  } catch {
    warnings.push("implementationRuntimeResetPartial");
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectStructureCandidateEdge.deleteMany({ where: { projectId: pid } });
    await tx.projectNodeLifecycle.deleteMany({ where: { projectId: pid } });
    await tx.projectMergeHistory.deleteMany({ where: { projectId: pid } });
    await tx.projectStructureCandidate.deleteMany({ where: { projectId: pid } });
    await clearProjectGraphProjection(tx, pid);
    await tx.projectEvent.deleteMany({ where: { projectId: pid } });
    await tx.projectMessage.deleteMany({ where: { projectId: pid } });
    await tx.taskExecutionRun.deleteMany({ where: { projectId: pid } });
    await tx.taskDraft.deleteMany({ where: { projectId: pid } });
    await tx.task.deleteMany({ where: { projectId: pid } });
    await tx.workNote.deleteMany({ where: { projectId: pid } });
    await tx.projectMemberAction.deleteMany({ where: { projectId: pid } });

    await tx.project.update({
      where: { id: pid },
      data: {
        requirementsConversationJson: null,
        requirementsDraftJson: null,
        requirementsStateJson: resetState as Prisma.InputJsonValue,
        requirementsRoomState: null,
      },
    });

    await tx.chatRoom.updateMany({
      where: { projectId: pid },
      data: { projectId: null },
    });
  });
}

export async function deleteChatRoomWithLinkedProject(input: Readonly<{
  readonly roomId: string;
  readonly userId: string;
  readonly confirmDeleteLinkedProjectData: boolean;
}>): Promise<DeleteChatRoomWithLinkedProjectResult> {
  const rid = String(input.roomId ?? "").trim();
  const uid = String(input.userId ?? "").trim();
  if (!rid || !uid) {
    return {
      ok: false,
      roomDeleted: false,
      linkedProjectReset: false,
      message: "삭제 중 문제가 발생했습니다. 다시 시도해 주세요.",
    };
  }

  let room;
  try {
    room = await assertChatRoomAccess(rid, uid);
  } catch (e) {
    if (e instanceof ChatRoomAccessError) {
      return {
        ok: false,
        roomDeleted: false,
        linkedProjectReset: false,
        message: e.code === "FORBIDDEN" ? "삭제 권한이 없습니다." : e.message,
      };
    }
    throw e;
  }

  if (room.ownerUserId !== uid) {
    return {
      ok: false,
      roomDeleted: false,
      linkedProjectReset: false,
      message: "삭제 권한이 없습니다.",
    };
  }

  const projectId = room.projectId?.trim() || null;
  const warnings: string[] = [];

  if (projectId) {
    if (!input.confirmDeleteLinkedProjectData) {
      return {
        ok: false,
        roomDeleted: false,
        linkedProjectReset: false,
        projectId,
        message: "연결된 프로젝트 데이터 삭제 확인이 필요합니다.",
      };
    }

    try {
      await requireProjectPermission(projectId, uid, "canEditProject", "deleteChatRoomWithLinkedProject");
    } catch {
      return {
        ok: false,
        roomDeleted: false,
        linkedProjectReset: false,
        projectId,
        message: "삭제 권한이 없습니다.",
      };
    }

    await resetLinkedProjectDataForChatRoomDelete(projectId, warnings);

    const soft = await softDeleteProjectByOwner(projectId, uid);
    if (!soft.ok) {
      if (soft.code === "FORBIDDEN") {
        warnings.push("projectSoftDeleteSkippedNotOwner");
      } else if (soft.code === "NOT_FOUND") {
        warnings.push("projectAlreadyRemoved");
      }
    }
  } else {
    await deleteChatRoomForOwner(rid, uid);
    return {
      ok: true,
      roomDeleted: true,
      linkedProjectReset: false,
      projectId: null,
      warnings: warnings.length ? warnings : undefined,
      message: "대화방이 삭제되었습니다.",
    };
  }

  try {
    await prisma.chatRoom.delete({ where: { id: rid } });
  } catch (e) {
    console.error("deleteChatRoomWithLinkedProject room delete", e);
    return {
      ok: false,
      roomDeleted: false,
      linkedProjectReset: true,
      projectId,
      warnings,
      message: "삭제 중 문제가 발생했습니다. 다시 시도해 주세요.",
    };
  }

  return {
    ok: true,
    roomDeleted: true,
    linkedProjectReset: true,
    projectId,
    warnings: warnings.length ? warnings : undefined,
    message: "대화방과 연결된 프로젝트 정보가 삭제되었습니다.",
  };
}
