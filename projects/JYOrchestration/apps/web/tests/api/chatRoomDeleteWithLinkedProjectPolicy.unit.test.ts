import { describe, expect, it, vi, beforeEach } from "vitest";
import { PROJECT_LIFECYCLE_ACTIVE, PROJECT_LIFECYCLE_DELETED } from "@/lib/project/projectLifecycle";

const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

const requireProjectPermission = vi.fn();

vi.mock("@/lib/auth/rbacGuard", () => ({
  requireProjectPermission: (...args: unknown[]) => requireProjectPermission(...args),
}));

describe("assertLinkedProjectDeleteAuthority", () => {
  beforeEach(() => {
    findUnique.mockReset();
    requireProjectPermission.mockReset();
  });

  it("allows chat owner who is project owner even when project is soft-deleted", async () => {
    findUnique.mockResolvedValue({
      ownerUserId: "user-a",
      status: PROJECT_LIFECYCLE_DELETED,
    });
    const { assertLinkedProjectDeleteAuthority } = await import(
      "@/lib/messenger/chatRoomDeleteWithLinkedProjectPolicy"
    );
    await expect(
      assertLinkedProjectDeleteAuthority({ projectId: "p1", chatOwnerUserId: "user-a" }),
    ).resolves.toBeUndefined();
    expect(requireProjectPermission).not.toHaveBeenCalled();
  });

  it("allows missing project (stale chat link) without RBAC", async () => {
    findUnique.mockResolvedValue(null);
    const { assertLinkedProjectDeleteAuthority } = await import(
      "@/lib/messenger/chatRoomDeleteWithLinkedProjectPolicy"
    );
    await expect(
      assertLinkedProjectDeleteAuthority({ projectId: "p1", chatOwnerUserId: "user-a" }),
    ).resolves.toBeUndefined();
    expect(requireProjectPermission).not.toHaveBeenCalled();
  });

  it("denies non-owner on soft-deleted project", async () => {
    findUnique.mockResolvedValue({
      ownerUserId: "user-a",
      status: PROJECT_LIFECYCLE_DELETED,
    });
    const { assertLinkedProjectDeleteAuthority, LinkedProjectDeleteForbiddenError } = await import(
      "@/lib/messenger/chatRoomDeleteWithLinkedProjectPolicy"
    );
    await expect(
      assertLinkedProjectDeleteAuthority({ projectId: "p1", chatOwnerUserId: "user-b" }),
    ).rejects.toBeInstanceOf(LinkedProjectDeleteForbiddenError);
  });

  it("falls back to canEditProject for active project when chat owner is not project owner", async () => {
    findUnique.mockResolvedValue({
      ownerUserId: "user-a",
      status: PROJECT_LIFECYCLE_ACTIVE,
    });
    requireProjectPermission.mockResolvedValue("EDITOR");
    const { assertLinkedProjectDeleteAuthority } = await import(
      "@/lib/messenger/chatRoomDeleteWithLinkedProjectPolicy"
    );
    await assertLinkedProjectDeleteAuthority({ projectId: "p1", chatOwnerUserId: "user-b" });
    expect(requireProjectPermission).toHaveBeenCalledWith(
      "p1",
      "user-b",
      "canEditProject",
      "deleteChatRoomWithLinkedProject",
    );
  });
});
