import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { PROJECT_LIFECYCLE_DELETED } from "@/lib/project/projectLifecycle";
import { prisma } from "@/lib/prisma";

export class LinkedProjectDeleteForbiddenError extends Error {
  constructor(message = "삭제 권한이 없습니다.") {
    super(message);
    this.name = "LinkedProjectDeleteForbiddenError";
  }
}

/**
 * 프로젝트 연결 대화방 「모두 삭제」 — 연결 데이터 초기화 권한.
 * - 대화방 소유자이면서 프로젝트 소유자: 소프트 삭제된 프로젝트 포함 항상 허용
 * - 그 외: 활성 프로젝트에서 `canEditProject` 보유 시 허용
 */
export async function assertLinkedProjectDeleteAuthority(input: Readonly<{
  readonly projectId: string;
  readonly chatOwnerUserId: string;
}>): Promise<void> {
  const pid = input.projectId.trim();
  const uid = input.chatOwnerUserId.trim();
  if (!pid || !uid) {
    throw new LinkedProjectDeleteForbiddenError();
  }

  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { ownerUserId: true, status: true },
  });
  if (!project) {
    return;
  }

  if (project.ownerUserId === uid) {
    return;
  }

  if (project.status === PROJECT_LIFECYCLE_DELETED) {
    throw new LinkedProjectDeleteForbiddenError(
      "삭제된 프로젝트는 프로젝트 소유자만 연결 데이터를 삭제할 수 있습니다.",
    );
  }

  try {
    await requireProjectPermission(pid, uid, "canEditProject", "deleteChatRoomWithLinkedProject");
  } catch {
    throw new LinkedProjectDeleteForbiddenError();
  }
}
